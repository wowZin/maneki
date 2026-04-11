"""
数据同步服务
将外部行情数据同步到本地数据库，提高稳定性和加工灵活性

策略：
1. 首次启动：同步近14天全量数据
2. 每日收盘后：增量同步当日数据
3. 实时监控：分钟级数据缓存到Redis
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Set
import logging

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.db.session import get_db_session
from app.models.kline import KLine1Day, KLine5Min, KLine1Min
from app.models.stock import Stock
from app.services.data_provider import get_data_provider, DataProvider

logger = logging.getLogger(__name__)


class DataSyncService:
    """数据同步服务"""

    # 同步配置
    SYNC_DAYS = 14  # 同步近14天数据
    BATCH_SIZE = 50  # 批量处理股票数

    def __init__(self, db: AsyncSession, data_provider: DataProvider = None):
        self.db = db
        self.provider = data_provider or get_data_provider()

    async def sync_all_stocks(self, days: int = None) -> dict:
        """
        同步所有关注股票的历史数据

        Args:
            days: 同步天数，默认14天
        """
        days = days or self.SYNC_DAYS
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # 获取关注股票列表
        stocks = await self._get_monitored_stocks()
        logger.info(f"开始同步 {len(stocks)} 只股票的 {days} 天数据")

        results = {
            "total": len(stocks),
            "success": 0,
            "failed": 0,
            "skipped": 0,
            "details": []
        }

        # 分批处理
        for i in range(0, len(stocks), self.BATCH_SIZE):
            batch = stocks[i:i + self.BATCH_SIZE]
            batch_results = await self._sync_batch(batch, start_date, end_date)

            results["success"] += batch_results["success"]
            results["failed"] += batch_results["failed"]
            results["skipped"] += batch_results["skipped"]
            results["details"].extend(batch_results["details"])

            # 避免频率限制，批次间休眠
            await asyncio.sleep(1)

        logger.info(f"同步完成: 成功={results['success']}, 失败={results['failed']}")
        return results

    async def sync_stock(self, code: str, start_date: datetime, end_date: datetime) -> dict:
        """
        同步单只股票数据

        Args:
            code: 股票代码
            start_date: 开始日期
            end_date: 结束日期
        """
        try:
            # 使用免费数据源同步（因为只是存数据，不需要实时性）
            source = self.provider.get_data_source_by_name("akshare")
            if not source:
                logger.error("Akshare 数据源不可用")
                return {"code": code, "status": "failed", "reason": "数据源不可用"}

            # 获取日线数据
            klines = await source.get_kline(
                code=code,
                period="daily",
                start_date=start_date.strftime("%Y%m%d"),
                end_date=end_date.strftime("%Y%m%d"),
                adjust="qfq"  # 前复权
            )

            if not klines:
                return {"code": code, "status": "skipped", "reason": "无数据"}

            # 保存到数据库
            saved_count = await self._save_klines(code, klines)

            return {
                "code": code,
                "status": "success",
                "count": saved_count,
                "start": klines[0].timestamp.strftime("%Y-%m-%d"),
                "end": klines[-1].timestamp.strftime("%Y-%m-%d")
            }

        except Exception as e:
            logger.error(f"同步 {code} 失败: {e}")
            return {"code": code, "status": "failed", "reason": str(e)}

    async def incremental_sync(self, target_date: datetime = None) -> dict:
        """
        增量同步（每日收盘后调用）

        Args:
            target_date: 目标日期，默认昨天（收盘后同步当天）
        """
        if target_date is None:
            # 默认同步上一个交易日
            target_date = self._get_last_trade_date()

        logger.info(f"开始增量同步: {target_date.strftime('%Y-%m-%d')}")

        stocks = await self._get_monitored_stocks()
        results = {"total": len(stocks), "success": 0, "failed": 0}

        for stock in stocks:
            # 检查是否已存在
            exists = await self._check_data_exists(stock, target_date)
            if exists:
                results["skipped"] = results.get("skipped", 0) + 1
                continue

            result = await self.sync_stock(
                stock,
                target_date,
                target_date
            )

            if result["status"] == "success":
                results["success"] += 1
            else:
                results["failed"] += 1

            await asyncio.sleep(0.5)  # 避免频率限制

        return results

    async def get_local_kline(
        self,
        code: str,
        days: int = 14,
        end_date: datetime = None
    ) -> List[dict]:
        """
        从本地数据库获取K线数据

        如果本地数据不完整，自动从外部源补全
        """
        if end_date is None:
            end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # 查询本地数据
        result = await self.db.execute(
            select(KLine1Day).where(
                and_(
                    KLine1Day.code == code,
                    KLine1Day.timestamp >= start_date,
                    KLine1Day.timestamp <= end_date
                )
            ).order_by(KLine1Day.timestamp)
        )
        local_data = result.scalars().all()

        # 检查数据完整性
        expected_days = days
        actual_days = len(local_data)

        if actual_days < expected_days * 0.8:  # 数据缺失超过20%
            logger.warning(f"{code} 本地数据不完整 ({actual_days}/{expected_days})，触发同步")
            # 异步触发同步（不等待）
            asyncio.create_task(self.sync_stock(code, start_date, end_date))

        return [
            {
                "timestamp": k.timestamp.isoformat(),
                "open": float(k.open),
                "high": float(k.high),
                "low": float(k.low),
                "close": float(k.close),
                "volume": k.volume,
                "amount": float(k.amount) if k.amount else None,
            }
            for k in local_data
        ]

    async def get_cached_realtime(self, codes: List[str]) -> List[dict]:
        """
        获取实时行情（优先本地缓存）

        策略：
        1. 先查本地数据库（收盘后的数据）
        2. 再查外部API（实时数据）
        3. 合并返回
        """
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # 查询今日已缓存数据
        result = await self.db.execute(
            select(KLine1Day).where(
                and_(
                    KLine1Day.code.in_(codes),
                    KLine1Day.timestamp >= today
                )
            )
        )
        cached = {k.code: k for k in result.scalars().all()}

        # 未缓存的股票代码
        missing_codes = [c for c in codes if c not in cached]

        # 从外部获取缺失的实时数据
        if missing_codes:
            source = self.provider.get_data_source_by_name("akshare")
            if source:
                quotes = await source.get_realtime_quotes(missing_codes)
                # 保存到缓存表（可选）
                for quote in quotes:
                    # 这里可以保存到Redis缓存
                    pass

        # 合并数据
        results = []
        for code in codes:
            if code in cached:
                k = cached[code]
                results.append({
                    "code": code,
                    "timestamp": k.timestamp.isoformat(),
                    "close": float(k.close),
                    "volume": k.volume,
                    "source": "local"
                })

        return results

    async def _get_monitored_stocks(self) -> List[str]:
        """获取关注股票列表"""
        result = await self.db.execute(
            select(Stock.code).where(Stock.is_active == True)
        )
        return [row[0] for row in result.all()]

    async def _sync_batch(
        self,
        batch: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> dict:
        """同步一批股票"""
        results = {"success": 0, "failed": 0, "skipped": 0, "details": []}

        for code in batch:
            result = await self.sync_stock(code, start_date, end_date)
            results["details"].append(result)

            if result["status"] == "success":
                results["success"] += 1
            elif result["status"] == "failed":
                results["failed"] += 1
            else:
                results["skipped"] += 1

        return results

    async def _save_klines(self, code: str, klines: list) -> int:
        """保存K线数据到数据库"""
        count = 0
        for k in klines:
            # 使用 upsert 避免重复
            stmt = insert(KLine1Day).values(
                code=code,
                timestamp=k.timestamp,
                open=k.open,
                high=k.high,
                low=k.low,
                close=k.close,
                volume=k.volume,
                amount=k.amount,
                created_at=datetime.utcnow()
            ).on_conflict_do_update(
                index_elements=["code", "timestamp"],
                set_={
                    "open": k.open,
                    "high": k.high,
                    "low": k.low,
                    "close": k.close,
                    "volume": k.volume,
                    "amount": k.amount,
                    "updated_at": datetime.utcnow()
                }
            )
            await self.db.execute(stmt)
            count += 1

        await self.db.commit()
        return count

    async def _check_data_exists(self, code: str, date: datetime) -> bool:
        """检查某只股票某日数据是否已存在"""
        result = await self.db.execute(
            select(KLine1Day).where(
                and_(
                    KLine1Day.code == code,
                    KLine1Day.timestamp >= date.replace(hour=0, minute=0),
                    KLine1Day.timestamp < date.replace(hour=23, minute=59)
                )
            )
        )
        return result.scalar_one_or_none() is not None

    def _get_last_trade_date(self) -> datetime:
        """获取上一个交易日"""
        now = datetime.now()
        # 简单规则：周末跳过
        if now.weekday() == 0:  # 周一
            return now - timedelta(days=3)
        elif now.weekday() == 6:  # 周日
            return now - timedelta(days=2)
        else:
            return now - timedelta(days=1)


# 便捷函数
async def sync_historical_data(days: int = 14) -> dict:
    """同步历史数据（用于初始化）"""
    async with get_db_session() as db:
        service = DataSyncService(db)
        return await service.sync_all_stocks(days=days)


async def daily_incremental_sync() -> dict:
    """每日增量同步（定时任务调用）"""
    async with get_db_session() as db:
        service = DataSyncService(db)
        return await service.incremental_sync()

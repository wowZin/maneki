"""
数据同步 Celery 任务
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Set

from celery import shared_task
from sqlalchemy import select, and_, func

from app.db.session import get_db_session, async_session_maker, AsyncSessionLocal
from app.models.kline import KLine1Day
from app.models.stock import Stock
from app.services.data_sync import DataSyncService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def daily_incremental_sync(self):
    """
    每日增量同步任务
    在收盘后(15:35)执行，同步当日数据
    """
    logger.info("开始执行每日增量同步任务")

    async def _sync():
        async with get_db_session() as db:
            service = DataSyncService(db)
            return await service.incremental_sync()

    try:
        # 运行异步任务
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(_sync())

        logger.info(f"每日增量同步完成: {result}")
        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.error(f"每日增量同步失败: {exc}")
        # 重试
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def sync_historical_data(self, days: int = 14, stock_codes: List[str] = None):
    """
    同步历史数据任务

    Args:
        days: 同步天数
        stock_codes: 指定股票代码列表，None则同步所有关注股票
    """
    logger.info(f"开始同步 {days} 天历史数据")

    async def _sync():
        async with get_db_session() as db:
            service = DataSyncService(db)

            if stock_codes:
                # 同步指定股票
                results = {"total": len(stock_codes), "success": 0, "failed": 0, "details": []}
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days)

                for code in stock_codes:
                    result = await service.sync_stock(code, start_date, end_date)
                    results["details"].append(result)
                    if result["status"] == "success":
                        results["success"] += 1
                    else:
                        results["failed"] += 1

                return results
            else:
                # 同步所有关注股票
                return await service.sync_all_stocks(days=days)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(_sync())

        logger.info(f"历史数据同步完成: 成功={result.get('success', 0)}, 失败={result.get('failed', 0)}")
        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.error(f"历史数据同步失败: {exc}")
        raise self.retry(exc=exc)


@shared_task
def check_data_completeness():
    """
    检查数据完整性
    发现并报告缺失的数据
    """
    logger.info("开始检查数据完整性")

    async def _check():
        async with async_session_maker() as db:
            # 获取关注股票列表
            result = await db.execute(
                select(Stock.code).where(Stock.is_active == True)
            )
            stocks = [row[0] for row in result.all()]

            # 检查近14天数据完整性
            end_date = datetime.now()
            start_date = end_date - timedelta(days=14)

            incomplete_stocks = []

            for code in stocks:
                # 统计该股票在日期范围内的数据条数
                result = await db.execute(
                    select(func.count(KLine1Day.id)).where(
                        and_(
                            KLine1Day.code == code,
                            KLine1Day.timestamp >= start_date,
                            KLine1Day.timestamp <= end_date
                        )
                    )
                )
                count = result.scalar()

                # 简单规则：期望至少10个交易日数据
                if count < 10:
                    incomplete_stocks.append({
                        "code": code,
                        "actual_days": count,
                        "expected_days": 10,
                    })

            return {
                "total_checked": len(stocks),
                "incomplete_count": len(incomplete_stocks),
                "incomplete_stocks": incomplete_stocks,
            }

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(_check())

        if result["incomplete_count"] > 0:
            logger.warning(f"发现 {result['incomplete_count']} 只股票数据不完整")

            # 触发补充同步
            for stock_info in result["incomplete_stocks"][:10]:  # 最多补充10只
                sync_historical_data.delay(days=14, stock_codes=[stock_info["code"]])

        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.error(f"数据完整性检查失败: {exc}")
        return {
            "status": "error",
            "error": str(exc),
            "timestamp": datetime.now().isoformat(),
        }


@shared_task
def cleanup_old_data():
    """
    清理过期数据
    保留近14天数据，删除更早的数据
    """
    logger.info("开始清理过期数据")

    async def _cleanup():
        async with async_session_maker() as db:
            cutoff_date = datetime.now() - timedelta(days=14)

            # 删除14天前的数据
            from sqlalchemy import delete
            result = await db.execute(
                delete(KLine1Day).where(KLine1Day.timestamp < cutoff_date)
            )
            await db.commit()

            deleted_count = result.rowcount
            return {"deleted_count": deleted_count, "cutoff_date": cutoff_date.isoformat()}

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(_cleanup())

        logger.info(f"清理完成: 删除 {result['deleted_count']} 条过期数据")
        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.error(f"清理过期数据失败: {exc}")
        return {
            "status": "error",
            "error": str(exc),
            "timestamp": datetime.now().isoformat(),
        }

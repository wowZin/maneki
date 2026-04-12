"""
看板统计数据聚合任务

定时聚合Agent决策数据到统计表，加速看板查询
"""

from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy import select, func, and_, insert, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from loguru import logger

from app.db.session import AsyncSessionLocal
from app.models.decision import (
    AgentDecisionRecord,
    AgentDailyStats,
    UserOverallStats,
)


class DashboardStatsAggregator:
    """看板统计数据聚合器"""

    def __init__(self):
        self.logger = logger.bind(task="DashboardStatsAggregator")

    async def aggregate_daily_stats(
        self,
        target_date: Optional[date] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, int]:
        """
        聚合每日统计数据

        Args:
            target_date: 目标日期，默认昨天（因为今天的数据还未收盘）
            user_id: 指定用户，None则处理所有用户

        Returns:
            统计结果
        """
        if target_date is None:
            target_date = date.today() - timedelta(days=1)

        self.logger.info(f"开始聚合 {target_date} 的统计数据")

        async with AsyncSessionLocal() as db:
            # 1. 获取需要处理的Agent决策记录
            records = await self._get_decision_records(db, target_date, user_id)

            # 2. 按用户和Agent分组聚合
            stats_by_agent = self._aggregate_by_agent(records)

            # 3. 写入或更新每日统计表
            updated_count = 0
            for (uid, agent_id), stats in stats_by_agent.items():
                await self._upsert_daily_stats(db, target_date, uid, agent_id, stats)
                updated_count += 1

            await db.commit()

            self.logger.info(
                f"聚合完成: 处理了 {len(records)} 条记录, "
                f"更新了 {updated_count} 个Agent的统计数据"
            )

            return {
                "date": target_date.isoformat(),
                "records_processed": len(records),
                "agents_updated": updated_count,
            }

    async def aggregate_user_overall_stats(
        self,
        target_date: Optional[date] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, int]:
        """
        聚合用户整体统计数据

        Args:
            target_date: 目标日期
            user_id: 指定用户
        """
        if target_date is None:
            target_date = date.today() - timedelta(days=1)

        self.logger.info(f"开始聚合用户整体统计: {target_date}")

        async with AsyncSessionLocal() as db:
            # 1. 获取用户列表
            if user_id:
                users = [{"user_id": user_id}]
            else:
                users = await self._get_active_users(db, target_date)

            # 2. 为每个用户聚合整体统计
            updated_count = 0
            for user in users:
                uid = user["user_id"]
                await self._upsert_user_overall_stats(db, target_date, uid)
                updated_count += 1

            await db.commit()

            self.logger.info(f"用户整体统计聚合完成: 更新了 {updated_count} 个用户")

            return {
                "date": target_date.isoformat(),
                "users_updated": updated_count,
            }

    async def backfill_results(
        self,
        target_date: Optional[date] = None
    ) -> Dict[str, int]:
        """
        回填实际结果

        根据次日收盘数据，回填前一天的预测结果
        """
        if target_date is None:
            # 默认回填前天（昨天收盘后回填前天的数据）
            target_date = date.today() - timedelta(days=2)

        self.logger.info(f"开始回填 {target_date} 的预测结果")

        async with AsyncSessionLocal() as db:
            # 1. 获取需要回填的记录
            records = await self._get_pending_records(db, target_date)

            # 2. 查询实际行情数据
            filled_count = 0
            for record in records:
                result = await self._query_actual_result(
                    db, record.stock_code, target_date
                )
                if result:
                    await self._update_record_result(db, record.id, result)
                    filled_count += 1

            await db.commit()

            self.logger.info(f"结果回填完成: 更新了 {filled_count} 条记录")

            return {
                "date": target_date.isoformat(),
                "records_filled": filled_count,
            }

    async def _get_decision_records(
        self,
        db: AsyncSession,
        target_date: date,
        user_id: Optional[str]
    ) -> List[AgentDecisionRecord]:
        """获取决策记录"""
        query = select(AgentDecisionRecord).where(
            AgentDecisionRecord.decision_date == target_date
        )
        if user_id:
            query = query.where(AgentDecisionRecord.user_id == user_id)

        result = await db.execute(query)
        return result.scalars().all()

    def _aggregate_by_agent(
        self,
        records: List[AgentDecisionRecord]
    ) -> Dict[tuple, Dict]:
        """按用户和Agent分组聚合"""
        stats = {}

        for record in records:
            key = (str(record.user_id), record.agent_id)

            if key not in stats:
                stats[key] = {
                    "agent_name": record.agent_name,
                    "agent_type": record.agent_type,
                    "is_custom": record.is_custom,
                    "total": 0,
                    "success": 0,
                    "fail": 0,
                    "pending": 0,
                    "strong_buy": 0,
                    "buy": 0,
                    "hold": 0,
                    "sell": 0,
                    "strong_sell": 0,
                    "confidence_sum": 0.0,
                    "return_sum": 0.0,
                }

            s = stats[key]
            s["total"] += 1
            s["confidence_sum"] += record.confidence

            # 统计决策类型
            if record.decision == "strong_buy":
                s["strong_buy"] += 1
            elif record.decision == "buy":
                s["buy"] += 1
            elif record.decision == "hold":
                s["hold"] += 1
            elif record.decision == "sell":
                s["sell"] += 1
            elif record.decision == "strong_sell":
                s["strong_sell"] += 1

            # 统计结果
            if record.actual_result == "success":
                s["success"] += 1
            elif record.actual_result == "fail":
                s["fail"] += 1
            else:
                s["pending"] += 1

            if record.actual_return:
                s["return_sum"] += record.actual_return

        return stats

    async def _upsert_daily_stats(
        self,
        db: AsyncSession,
        stats_date: date,
        user_id: str,
        agent_id: str,
        stats: Dict
    ):
        """插入或更新每日统计"""
        total = stats["total"]
        success = stats["success"]
        success_rate = success / total if total > 0 else 0.0
        avg_confidence = stats["confidence_sum"] / total if total > 0 else 0.0
        avg_return = stats["return_sum"] / total if total > 0 else None

        # 使用PostgreSQL的UPSERT
        stmt = pg_insert(AgentDailyStats).values(
            user_id=user_id,
            agent_id=agent_id,
            agent_name=stats["agent_name"],
            agent_type=stats["agent_type"],
            is_custom=stats["is_custom"],
            stats_date=stats_date,
            total_predictions=total,
            success_count=success,
            fail_count=stats["fail"],
            pending_count=stats["pending"],
            success_rate=success_rate,
            strong_buy_count=stats["strong_buy"],
            buy_count=stats["buy"],
            hold_count=stats["hold"],
            sell_count=stats["sell"],
            strong_sell_count=stats["strong_sell"],
            avg_confidence=avg_confidence,
            avg_return=avg_return,
        ).on_conflict_do_update(
            index_elements=["user_id", "agent_id", "stats_date"],
            set_={
                "total_predictions": total,
                "success_count": success,
                "fail_count": stats["fail"],
                "pending_count": stats["pending"],
                "success_rate": success_rate,
                "strong_buy_count": stats["strong_buy"],
                "buy_count": stats["buy"],
                "hold_count": stats["hold"],
                "sell_count": stats["sell"],
                "strong_sell_count": stats["strong_sell"],
                "avg_confidence": avg_confidence,
                "avg_return": avg_return,
                "updated_at": datetime.utcnow(),
            }
        )

        await db.execute(stmt)

    async def _get_active_users(
        self,
        db: AsyncSession,
        target_date: date
    ) -> List[Dict]:
        """获取有数据的活跃用户"""
        query = select(
            AgentDecisionRecord.user_id
        ).distinct().where(
            AgentDecisionRecord.decision_date == target_date
        )

        result = await db.execute(query)
        return [{"user_id": str(uid)} for uid in result.scalars().all()]

    async def _upsert_user_overall_stats(
        self,
        db: AsyncSession,
        target_date: date,
        user_id: str
    ):
        """插入或更新用户整体统计"""
        # 1. 查询该用户当天的Agent统计
        query = select(AgentDailyStats).where(
            and_(
                AgentDailyStats.user_id == user_id,
                AgentDailyStats.stats_date == target_date
            )
        )
        result = await db.execute(query)
        agent_stats = result.scalars().all()

        if not agent_stats:
            return

        # 2. 计算整体指标
        total_predictions = sum(s.total_predictions for s in agent_stats)
        total_success = sum(s.success_count for s in agent_stats)
        success_rate = total_success / total_predictions if total_predictions > 0 else 0.0

        active_agents = len([s for s in agent_stats if s.total_predictions > 0])

        # 3. 查询前一天的环比数据
        prev_date = target_date - timedelta(days=1)
        prev_query = select(UserOverallStats).where(
            and_(
                UserOverallStats.user_id == user_id,
                UserOverallStats.stats_date == prev_date
            )
        )
        prev_result = await db.execute(prev_query)
        prev_stats = prev_result.scalar_one_or_none()

        prev_rate = prev_stats.overall_success_rate if prev_stats else None
        rate_change = success_rate - prev_rate if prev_rate else None

        # 4. UPSERT
        stmt = pg_insert(UserOverallStats).values(
            user_id=user_id,
            stats_date=target_date,
            total_predictions=total_predictions,
            total_success=total_success,
            overall_success_rate=success_rate,
            active_agent_count=active_agents,
            total_agent_count=len(agent_stats),
            prev_day_rate=prev_rate,
            rate_change=rate_change,
        ).on_conflict_do_update(
            index_elements=["user_id", "stats_date"],
            set_={
                "total_predictions": total_predictions,
                "total_success": total_success,
                "overall_success_rate": success_rate,
                "active_agent_count": active_agents,
                "total_agent_count": len(agent_stats),
                "prev_day_rate": prev_rate,
                "rate_change": rate_change,
                "updated_at": datetime.utcnow(),
            }
        )

        await db.execute(stmt)

    async def _get_pending_records(
        self,
        db: AsyncSession,
        target_date: date
    ) -> List[AgentDecisionRecord]:
        """获取待回填的记录"""
        query = select(AgentDecisionRecord).where(
            and_(
                AgentDecisionRecord.decision_date == target_date,
                AgentDecisionRecord.actual_result.is_(None)
            )
        )
        result = await db.execute(query)
        return result.scalars().all()

    async def _query_actual_result(
        self,
        db: AsyncSession,
        stock_code: str,
        target_date: date
    ) -> Optional[Dict]:
        """查询实际结果"""
        # TODO: 从行情数据表查询
        # 这里模拟返回数据
        return {
            "actual_result": "success",
            "actual_return": 10.0,
            "did_limit_up": True,
        }

    async def _update_record_result(
        self,
        db: AsyncSession,
        record_id: str,
        result: Dict
    ):
        """更新记录结果"""
        stmt = update(AgentDecisionRecord).where(
            AgentDecisionRecord.id == record_id
        ).values(
            actual_result=result["actual_result"],
            actual_return=result.get("actual_return"),
            did_limit_up=result.get("did_limit_up"),
            updated_at=datetime.utcnow(),
        )
        await db.execute(stmt)


# 定时任务入口
aggregator = DashboardStatsAggregator()


async def aggregate_daily_stats_task():
    """每日统计聚合任务"""
    yesterday = date.today() - timedelta(days=1)
    return await aggregator.aggregate_daily_stats(yesterday)


async def aggregate_user_stats_task():
    """用户整体统计聚合任务"""
    yesterday = date.today() - timedelta(days=1)
    return await aggregator.aggregate_user_overall_stats(yesterday)


async def backfill_results_task():
    """结果回填任务"""
    day_before_yesterday = date.today() - timedelta(days=2)
    return await aggregator.backfill_results(day_before_yesterday)


async def run_all_stats_tasks():
    """运行所有统计任务"""
    logger.info("开始执行所有看板统计任务")

    # 1. 先回填结果
    result1 = await backfill_results_task()
    logger.info(f"结果回填完成: {result1}")

    # 2. 聚合Agent每日统计
    result2 = await aggregate_daily_stats_task()
    logger.info(f"Agent每日统计聚合完成: {result2}")

    # 3. 聚合用户整体统计
    result3 = await aggregate_user_stats_task()
    logger.info(f"用户整体统计聚合完成: {result3}")

    return {
        "backfill": result1,
        "agent_daily": result2,
        "user_overall": result3,
    }

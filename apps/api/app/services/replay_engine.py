"""
复盘引擎
每日收盘后进行成功率统计和Agent权重调整
使用 Polars 进行高性能数据分析
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Any

import polars as pl
from loguru import logger
from sqlalchemy import text, select

from app.db.session import engine, get_db_session
from app.models.signal import Signal
from app.models.replay import ReplayResult, AgentLearning
from app.models.decision import AgentDecision
from app.core.config import settings


class ReplayEngine:
    """复盘引擎"""

    def __init__(self):
        pass

    async def load_signals_with_kline(
        self,
        trade_date: date
    ) -> pl.DataFrame:
        """
        加载某日的信号和对应的K线数据
        使用 Polars 进行高性能数据处理
        """
        query = f"""
        SELECT
            s.id as signal_id,
            s.code,
            s.signal_type,
            s.confidence,
            s.trigger_price,
            s.created_at,
            s.reason,
            s.agents_votes,
            k.time,
            k.close,
            k.high,
            k.low,
            k.volume
        FROM signals s
        LEFT JOIN kline_1min k
            ON s.code = k.code
            AND k.time BETWEEN s.created_at
            AND s.created_at + INTERVAL '1 day'
        WHERE DATE(s.created_at) = '{trade_date}'
        ORDER BY s.id, k.time
        """

        try:
            # 使用 Polars 直接读取数据库
            df = pl.read_database(query, engine)
            return df
        except Exception as e:
            logger.error(f"加载复盘数据失败: {e}")
            return pl.DataFrame()

    async def calculate_signal_performance(
        self,
        df: pl.DataFrame
    ) -> pl.DataFrame:
        """
        计算每个信号的表现指标
        使用 Polars 分组聚合
        """
        if df.is_empty():
            return pl.DataFrame()

        try:
            result = df.group_by('signal_id').agg([
                # 基本信息
                pl.first('code').alias('code'),
                pl.first('signal_type').alias('signal_type'),
                pl.first('confidence').alias('confidence'),
                pl.first('trigger_price').alias('entry_price'),
                pl.first('created_at').alias('signal_time'),

                # 价格统计
                pl.col('high').max().alias('max_price'),
                pl.col('low').min().alias('min_price'),
                pl.col('close').last().alias('close_price'),

                # 收益计算
                ((pl.col('high').max() - pl.first('trigger_price'))
                 / pl.first('trigger_price') * 100).alias('max_return_pct'),

                ((pl.col('close').last() - pl.first('trigger_price'))
                 / pl.first('trigger_price') * 100).alias('close_return_pct'),

                # 最大回撤
                ((pl.first('trigger_price') - pl.col('low').min())
                 / pl.first('trigger_price') * 100).alias('max_drawdown_pct'),

                # 是否涨停（涨超9.5%）
                (pl.col('high').max() / pl.first('trigger_price') >= 1.095)
                    .alias('hit_limit_up'),

                # 交易时长（分钟）
                ((pl.col('time').max() - pl.col('time').min())
                 .dt.total_minutes()).alias('trade_duration_min')
            ])

            return result

        except Exception as e:
            logger.error(f"计算信号表现失败: {e}")
            return pl.DataFrame()

    async def save_replay_results(
        self,
        performance_df: pl.DataFrame,
        trade_date: date
    ):
        """
        保存复盘结果到数据库
        """
        if performance_df.is_empty():
            logger.info("没有信号需要复盘")
            return

        async with get_db_session() as session:
            for row in performance_df.iter_rows(named=True):
                try:
                    # 判断成功标准
                    success = row.get('hit_limit_up', False) or \
                             row.get('max_return_pct', 0) >= 5.0

                    success_type = None
                    if row.get('hit_limit_up'):
                        success_type = 'limit_up'
                    elif row.get('max_return_pct', 0) >= 5.0:
                        success_type = 'target_reached'

                    replay_result = ReplayResult(
                        trade_date=trade_date,
                        signal_id=row['signal_id'],
                        code=row['code'],
                        entry_price=Decimal(str(row['entry_price'])) if row['entry_price'] else None,
                        max_price=Decimal(str(row['max_price'])) if row['max_price'] else None,
                        min_price=Decimal(str(row['min_price'])) if row['min_price'] else None,
                        close_price=Decimal(str(row['close_price'])) if row['close_price'] else None,
                        max_return_pct=Decimal(str(round(row['max_return_pct'], 2))) if row['max_return_pct'] else None,
                        actual_return_pct=Decimal(str(round(row['close_return_pct'], 2))) if row['close_return_pct'] else None,
                        success=success,
                        success_type=success_type,
                        failure_reason=None if success else self._analyze_failure(row),
                    )

                    session.add(replay_result)

                except Exception as e:
                    logger.error(f"保存复盘结果失败: {e}")

        logger.info(f"复盘结果已保存: {len(performance_df)} 条")

    def _analyze_failure(self, row: Dict) -> str:
        """分析失败原因"""
        max_return = row.get('max_return_pct', 0)
        close_return = row.get('close_return_pct', 0)

        if max_return > 2 and close_return < 0:
            return 'reverse'  # 冲高回落
        elif max_return < 1:
            return 'fake_breakout'  # 假突破
        else:
            return 'other'

    async def calculate_agent_success_rate(
        self,
        trade_date: date
    ) -> pl.DataFrame:
        """
        按Agent统计成功率
        使用 Polars 进行分组聚合
        """
        query = f"""
        SELECT
            ad.agent_type,
            rr.success,
            rr.actual_return_pct,
            rr.max_return_pct,
            rr.trade_date
        FROM agent_decisions ad
        JOIN replay_results rr ON ad.signal_id = rr.signal_id
        WHERE rr.trade_date = '{trade_date}'
        """

        try:
            df = pl.read_database(query, engine)

            if df.is_empty():
                return pl.DataFrame()

            stats = df.group_by('agent_type').agg([
                pl.count().alias('total_signals'),
                pl.col('success').sum().alias('success_count'),
                (pl.col('success').sum() / pl.count() * 100).alias('success_rate'),
                pl.col('actual_return_pct').mean().alias('avg_actual_return'),
                pl.col('max_return_pct').mean().alias('avg_max_return'),
            ]).sort('success_rate', descending=True)

            return stats

        except Exception as e:
            logger.error(f"计算Agent成功率失败: {e}")
            return pl.DataFrame()

    async def update_agent_weights(
        self,
        stats_df: pl.DataFrame,
        trade_date: date
    ):
        """
        根据成功率更新Agent权重
        """
        if stats_df.is_empty():
            return

        async with get_db_session() as session:
            for row in stats_df.iter_rows(named=True):
                try:
                    agent_type = row['agent_type']
                    success_rate = row['success_rate']

                    # 计算新权重
                    # 成功率 > 70%: 权重不变或增加
                    # 成功率 50-70%: 权重不变
                    # 成功率 < 50%: 降低权重
                    if success_rate >= 70:
                        new_weight = min(1.0, 1.0)
                        adjustment = "保持高权重"
                    elif success_rate >= 50:
                        new_weight = 0.8
                        adjustment = "保持中等权重"
                    else:
                        new_weight = 0.6
                        adjustment = "降低权重"

                    learning = AgentLearning(
                        trade_date=trade_date,
                        agent_type=agent_type,
                        total_signals=row['total_signals'],
                        success_count=row['success_count'],
                        failure_count=row['total_signals'] - row['success_count'],
                        success_rate=Decimal(str(round(success_rate, 2))),
                        old_weight=Decimal('1.0'),  # 默认原权重
                        new_weight=Decimal(str(new_weight)),
                        adjustment_reason=f"成功率{success_rate:.1f}%，{adjustment}",
                    )

                    session.add(learning)

                except Exception as e:
                    logger.error(f"更新Agent权重失败: {e}")

        logger.info("Agent权重已更新")

    async def generate_replay_report(
        self,
        trade_date: date
    ) -> Dict[str, Any]:
        """
        生成复盘报告
        """
        # 加载复盘结果
        query = f"""
        SELECT
            COUNT(*) as total_signals,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
            AVG(max_return_pct) as avg_max_return,
            AVG(actual_return_pct) as avg_actual_return
        FROM replay_results
        WHERE trade_date = '{trade_date}'
        """

        try:
            df = pl.read_database(query, engine)

            if df.is_empty():
                return {"message": "无复盘数据"}

            row = df.row(0, named=True)

            total = row['total_signals'] or 0
            success = row['success_count'] or 0
            success_rate = (success / total * 100) if total > 0 else 0

            report = {
                'trade_date': str(trade_date),
                'total_signals': total,
                'success_count': success,
                'success_rate': round(success_rate, 2),
                'avg_max_return': round(row['avg_max_return'] or 0, 2),
                'avg_actual_return': round(row['avg_actual_return'] or 0, 2),
            }

            logger.info(f"复盘报告: {report}")
            return report

        except Exception as e:
            logger.error(f"生成复盘报告失败: {e}")
            return {"error": str(e)}

    async def run_daily_replay(self, trade_date: Optional[date] = None):
        """
        运行每日复盘流程
        """
        if trade_date is None:
            trade_date = date.today() - timedelta(days=1)

        logger.info(f"开始复盘: {trade_date}")

        # 1. 加载信号数据
        df = await self.load_signals_with_kline(trade_date)
        logger.info(f"加载 {len(df)} 条信号/K线数据")

        # 2. 计算信号表现
        performance_df = await self.calculate_signal_performance(df)
        logger.info(f"计算 {len(performance_df)} 个信号的表现")

        # 3. 保存复盘结果
        await self.save_replay_results(performance_df, trade_date)

        # 4. 计算Agent成功率
        agent_stats = await self.calculate_agent_success_rate(trade_date)
        logger.info(f"Agent统计: {len(agent_stats)} 个Agent")

        # 5. 更新Agent权重
        await self.update_agent_weights(agent_stats, trade_date)

        # 6. 生成报告
        report = await self.generate_replay_report(trade_date)

        logger.info(f"复盘完成: {report}")
        return report


# 全局复盘引擎实例
replay_engine = ReplayEngine()

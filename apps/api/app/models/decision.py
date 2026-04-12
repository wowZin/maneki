"""
Agent决策记录模型
用于存储看板统计所需的数据
"""
from datetime import datetime, date
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentDecisionRecord(Base):
    """
    Agent决策记录表

    记录每个Agent的每一次预测决策，用于后续统计分析
    """
    __tablename__ = "agent_decision_records"

    __table_args__ = (
        # 常用查询索引
        Index("idx_agent_decision_user_date", "user_id", "decision_date"),
        Index("idx_agent_decision_agent", "agent_id", "decision_date"),
        Index("idx_agent_decision_stock", "stock_code", "decision_date"),
        # 复合索引用于统计查询
        Index("idx_agent_decision_user_agent_date", "user_id", "agent_id", "decision_date"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # 用户维度（数据隔离）
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True, comment="用户ID"
    )

    # Agent信息
    agent_id: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="Agent唯一标识"
    )
    agent_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Agent名称"
    )
    agent_type: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="Agent类型: sentiment/technical/capital/fundamental"
    )
    is_custom: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="是否是用户自定义Agent"
    )

    # 股票信息
    stock_code: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="股票代码"
    )
    stock_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="股票名称"
    )

    # 决策信息
    decision: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="决策类型: strong_buy/buy/hold/sell/strong_sell/abstain"
    )
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, comment="置信度 0-1"
    )
    reasoning: Mapped[str] = mapped_column(
        String(1000), default="", comment="决策理由"
    )

    # 预测结果（次日收盘后回填）
    actual_result: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="实际结果: success/fail/pending"
    )
    actual_return: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="实际收益率(%)"
    )
    did_limit_up: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, comment="是否涨停"
    )

    # 时间维度
    decision_date: Mapped[date] = mapped_column(
        Date, nullable=False, index=True, comment="决策日期"
    )
    decision_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, comment="决策时间"
    )

    # 信号数据（JSON格式存储关键信号）
    signals: Mapped[Optional[str]] = mapped_column(
        String(2000), nullable=True, comment="关键信号JSON"
    )
    risk_factors: Mapped[Optional[str]] = mapped_column(
        String(1000), nullable=True, comment="风险因素JSON"
    )

    # 市场上下文
    market_sentiment: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="市场情绪: bullish/bearish/neutral"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<AgentDecisionRecord(user={self.user_id}, agent={self.agent_name}, stock={self.stock_code}, decision={self.decision})>"


class AgentDailyStats(Base):
    """
    Agent每日统计表

    预聚合每日统计数据，加速看板查询
    """
    __tablename__ = "agent_daily_stats"

    __table_args__ = (
        Index("idx_daily_stats_user_date", "user_id", "stats_date"),
        Index("idx_daily_stats_agent_date", "agent_id", "stats_date"),
        # 唯一约束：每个用户的每个Agent每天只有一条记录
        Index("idx_daily_stats_unique", "user_id", "agent_id", "stats_date", unique=True),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # 维度
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_type: Mapped[str] = mapped_column(String(32), nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    stats_date: Mapped[date] = mapped_column(Date, nullable=False)

    # 统计指标
    total_predictions: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    fail_count: Mapped[int] = mapped_column(Integer, default=0)
    pending_count: Mapped[int] = mapped_column(Integer, default=0)
    success_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # 详细统计
    strong_buy_count: Mapped[int] = mapped_column(Integer, default=0)
    buy_count: Mapped[int] = mapped_column(Integer, default=0)
    hold_count: Mapped[int] = mapped_column(Integer, default=0)
    sell_count: Mapped[int] = mapped_column(Integer, default=0)
    strong_sell_count: Mapped[int] = mapped_column(Integer, default=0)

    # 质量指标
    avg_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_return: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserOverallStats(Base):
    """
    用户整体统计表

    预聚合用户级别的统计数据
    """
    __tablename__ = "user_overall_stats"

    __table_args__ = (
        Index("idx_user_stats_date", "user_id", "stats_date"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    stats_date: Mapped[date] = mapped_column(Date, nullable=False)

    # 整体统计
    total_predictions: Mapped[int] = mapped_column(Integer, default=0)
    total_success: Mapped[int] = mapped_column(Integer, default=0)
    overall_success_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # Agent维度
    active_agent_count: Mapped[int] = mapped_column(Integer, default=0)
    total_agent_count: Mapped[int] = mapped_column(Integer, default=0)

    # 环比数据
    prev_day_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rate_change: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

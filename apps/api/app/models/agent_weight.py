"""
Agent 权重评分机制模型
实现多 Agent 权重管理和动态调整
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String,
    Numeric,
    Integer,
    Boolean,
    Text,
    Date,
    DateTime,
    Index,
    ForeignKey,
    JSON,
    desc,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AgentWeight(Base):
    """Agent 当前权重表 - 记录各 Agent 当前得分状态"""

    __tablename__ = "agent_weights"
    __table_args__ = (
        Index("idx_agent_weight_score", "current_score", "is_active"),
        Index("idx_agent_type", "agent_type", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Agent 标识
    agent_type: Mapped[str] = mapped_column(
        String(30), nullable=False, unique=True, comment="Agent类型标识"
    )
    agent_name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Agent显示名称"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Agent描述"
    )

    # 权重分数（核心字段）
    current_score: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="当前权重分 0-100"
    )
    initial_score: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="初始分数"
    )

    # 状态
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否激活"
    )
    is_eliminated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已淘汰"
    )
    elimination_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, comment="淘汰时间"
    )
    elimination_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="淘汰原因"
    )

    # 统计信息
    total_signals: Mapped[int] = mapped_column(
        Integer, default=0, comment="总信号数"
    )
    success_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="成功数"
    )
    failure_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="失败数"
    )
    overall_success_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True, comment="总体成功率%"
    )

    # 连续排名（用于判断是否连续垫底）
    consecutive_bottom_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="连续垫底次数"
    )

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    last_evaluation_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="上次评估日期"
    )

    # 关联历史记录
    history: Mapped[List["AgentWeightHistory"]] = relationship(
        "AgentWeightHistory",
        back_populates="agent_weight",
        order_by="desc(AgentWeightHistory.evaluation_date)",
    )

    def __repr__(self) -> str:
        return f"<AgentWeight({self.agent_type}: {self.current_score}, active={self.is_active})>"

    @property
    def is_elimination_candidate(self) -> bool:
        """是否是淘汰候选（低于60分）"""
        return self.current_score < 60 and not self.is_eliminated

    @property
    def status(self) -> str:
        """返回当前状态"""
        if self.is_eliminated:
            return "eliminated"
        elif self.current_score < 60:
            return "at_risk"
        elif self.current_score >= 90:
            return "excellent"
        elif self.current_score >= 70:
            return "good"
        else:
            return "fair"


class AgentWeightHistory(Base):
    """Agent 权重历史记录表 - 记录每日排名和得分变化"""

    __tablename__ = "agent_weight_history"
    __table_args__ = (
        Index("idx_history_date", "evaluation_date"),
        Index("idx_history_agent_date", "agent_weight_id", "evaluation_date"),
        Index("idx_history_rank", "evaluation_date", "daily_rank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 关联 AgentWeight
    agent_weight_id: Mapped[int] = mapped_column(
        ForeignKey("agent_weights.id", ondelete="CASCADE"), nullable=False
    )

    # 评估日期
    evaluation_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="评估日期"
    )

    # 当日统计
    daily_signals: Mapped[int] = mapped_column(
        Integer, default=0, comment="当日信号数"
    )
    daily_success: Mapped[int] = mapped_column(
        Integer, default=0, comment="当日成功数"
    )
    daily_failure: Mapped[int] = mapped_column(
        Integer, default=0, comment="当日失败数"
    )
    daily_success_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True, comment="当日成功率%"
    )

    # 排名
    daily_rank: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="当日排名"
    )
    total_agents: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="当日总Agent数"
    )

    # 得分变化
    score_before: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="调整前得分"
    )
    score_after: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="调整后得分"
    )
    score_change: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="得分变化（通常为-1或0）"
    )

    # 调整原因
    adjustment_reason: Mapped[str] = mapped_column(
        Text, nullable=False, comment="调整原因说明"
    )

    # 是否触发淘汰警告
    is_elimination_warning: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="是否触发淘汰警告"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # 关联
    agent_weight: Mapped["AgentWeight"] = relationship(
        "AgentWeight", back_populates="history"
    )

    def __repr__(self) -> str:
        return f"<AgentWeightHistory({self.agent_weight.agent_type}: {self.evaluation_date}, rank={self.daily_rank}, score={self.score_after})>"


class AgentDecisionWeight(Base):
    """Agent 决策权重记录表 - 记录每次决策时各 Agent 的权重分配"""

    __tablename__ = "agent_decision_weights"
    __table_args__ = (
        Index("idx_decision_weight_signal", "signal_id"),
        Index("idx_decision_weight_date", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(
        ForeignKey("signals.id", ondelete="CASCADE"), nullable=False
    )

    # 参与决策的 Agent 列表和权重（JSON 存储）
    agent_weights: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="各Agent权重 {agent_type: {weight: x.x, score: xx, normalized_weight: x.xxx}}"
    )

    # 决策算法说明
    algorithm_version: Mapped[str] = mapped_column(
        String(20), default="v1.0", comment="算法版本"
    )
    algorithm_description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="算法说明"
    )

    # 最终决策结果
    final_decision: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="最终决策: buy/sell/hold"
    )
    confidence_score: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, comment="置信度 0-1"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

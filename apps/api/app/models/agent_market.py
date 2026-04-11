import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, ForeignKey, UUID, Text, Index, Boolean, JSON, Enum, text
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentSubscriptionRebate(Base):
    """
    Agent 订阅返佣记录表
    记录用户订阅自定义Agent时给Owner的返佣
    """

    __tablename__ = "agent_subscription_rebates"
    __table_args__ = (
        Index("idx_rebate_owner", "owner_id", "status"),
        Index("idx_rebate_subscription", "subscription_id", unique=True),
        Index("idx_rebate_status_time", "status", "created_at"),
        Index("idx_rebate_settlement", "status", "settlement_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 关联信息
    subscription_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True,
        comment="订阅记录ID（关联外部订阅系统）"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, comment="Agent Owner用户ID"
    )
    subscriber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, comment="订阅用户ID"
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_templates.id", ondelete="SET NULL"),
        nullable=True, comment="订阅的Agent模板ID"
    )

    # 返佣金额
    rebate_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, comment="返佣金额（元）"
    )
    rebate_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 4), nullable=True, comment="返佣比例（如为按比例返佣）"
    )

    # 订阅信息
    subscription_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, comment="订阅金额"
    )
    subscription_days: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="订阅天数"
    )

    # 状态
    status: Mapped[str] = mapped_column(
        String(20), default="pending", comment="状态: pending/settled/cancelled/refunded"
    )

    # 结算时间
    settlement_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, comment="预计结算时间"
    )
    settled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, comment="实际结算时间"
    )

    # 退款信息（如果发生退款）
    refunded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, comment="退款时间"
    )
    refund_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, comment="退款金额"
    )

    # 备注
    remark: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="备注"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<AgentSubscriptionRebate(owner={self.owner_id}, amount={self.rebate_amount}, status={self.status})>"


class AgentOwnerStats(Base):
    """
    Agent Owner 统计表
    缓存每个Agent创建者的收益统计
    """

    __tablename__ = "agent_owner_stats"
    __table_args__ = (
        Index("idx_owner_stats_rebate", "total_rebate_earned", "owner_id"),
        Index("idx_owner_stats_subscribers", "total_subscribers", "owner_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )

    # Agent统计
    total_agents: Mapped[int] = mapped_column(
        Integer, default=0, comment="创建的Agent总数"
    )
    public_agents: Mapped[int] = mapped_column(
        Integer, default=0, comment="公开的Agent数"
    )
    featured_agents: Mapped[int] = mapped_column(
        Integer, default=0, comment="精选Agent数"
    )

    # 订阅统计
    total_subscribers: Mapped[int] = mapped_column(
        Integer, default=0, comment="累计订阅人数"
    )
    active_subscribers: Mapped[int] = mapped_column(
        Integer, default=0, comment="当前活跃订阅人数"
    )

    # 返佣统计
    total_rebate_earned: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), comment="累计获得返佣"
    )
    pending_rebate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), comment="待结算返佣"
    )
    settled_rebate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), comment="已结算返佣"
    )
    cancelled_rebate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), comment="已取消返佣"
    )

    # 本月统计
    this_month_rebate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), comment="本月返佣"
    )
    this_month_subscribers: Mapped[int] = mapped_column(
        Integer, default=0, comment="本月新增订阅"
    )

    last_updated: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<AgentOwnerStats(owner={self.owner_id}, rebate={self.total_rebate_earned})>"


# TODO: 以下模型需要完整实现，当前为存根类以满足导入需求


class AgentTemplate(Base):
    """Agent 模板表"""
    __tablename__ = "agent_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentTemplateRatingStats(Base):
    """Agent 模板评分统计表"""
    __tablename__ = "agent_template_rating_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_templates.id"))
    avg_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0"))
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)


class UserAgent(Base):
    """用户自定义 Agent 表"""
    __tablename__ = "user_agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserAgentHistory(Base):
    """用户 Agent 历史记录表"""
    __tablename__ = "user_agent_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_agents.id"))
    event: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserAgentDecision(Base):
    """用户 Agent 决策表"""
    __tablename__ = "user_agent_decisions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_agents.id"))
    stock_code: Mapped[str] = mapped_column(String(20), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserAgentMarketFavorite(Base):
    """用户 Agent 市场收藏表"""
    __tablename__ = "user_agent_market_favorites"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_templates.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AgentMarketReview(Base):
    """Agent 市场评价表"""
    __tablename__ = "agent_market_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_templates.id"))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

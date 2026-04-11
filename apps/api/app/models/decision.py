"""
Agent决策记录模型
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    String,
    Numeric,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AgentDecision(Base):
    """Agent决策详情表"""

    __tablename__ = "agent_decisions"
    __table_args__ = (
        Index("idx_decision_signal", "signal_id"),
        Index("idx_decision_type", "agent_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(
        ForeignKey("signals.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    agent_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="Agent类型"
    )
    decision: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="决策: buy/sell/hold"
    )
    score: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True, comment="评分 0-1"
    )
    reasoning: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="决策理由"
    )
    weight: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=1.0, comment="权重"
    )

    # 关联关系
    signal: Mapped["Signal"] = relationship("Signal", back_populates="decisions")

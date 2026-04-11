"""
交易信号模型
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    String,
    Numeric,
    Index,
    ForeignKey,
    JSON,
    Boolean,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Signal(Base):
    """交易信号记录表"""

    __tablename__ = "signals"
    __table_args__ = (
        Index("idx_signal_code", "code", "created_at"),
        Index("idx_signal_type", "signal_type", "created_at"),
        Index("idx_signal_date", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, comment="信号生成时间")
    code: Mapped[str] = mapped_column(
        ForeignKey("stocks.code", ondelete="CASCADE"), nullable=False, comment="股票代码"
    )
    signal_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="信号类型: buy/sell/watch/alert"
    )
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, comment="置信度 0.00-1.00"
    )
    trigger_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="触发价格"
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="信号原因描述")
    agents_votes: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="各Agent投票详情"
    )
    extra_data: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="额外元数据"
    )
    is_valid: Mapped[bool] = mapped_column(default=True, comment="是否有效（复盘时标记）")

    # 关联关系
    stock: Mapped["Stock"] = relationship("Stock", back_populates="signals")
    decisions: Mapped[list["AgentDecision"]] = relationship(
        "AgentDecision", back_populates="signal"
    )

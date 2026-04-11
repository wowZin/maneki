"""
复盘结果模型
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, Any

from sqlalchemy import (
    String,
    Numeric,
    ForeignKey,
    Text,
    Boolean,
    Index,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ReplayResult(Base):
    """每日复盘结果表"""

    __tablename__ = "replay_results"
    __table_args__ = (
        Index("idx_replay_date", "trade_date"),
        Index("idx_replay_code", "code", "trade_date"),
        Index("idx_replay_success", "success", "trade_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trade_date: Mapped[date] = mapped_column(nullable=False, comment="交易日期")
    signal_id: Mapped[int] = mapped_column(
        ForeignKey("signals.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(nullable=False, comment="股票代码")

    # 决策时信息
    entry_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="决策时价格"
    )
    target_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="目标价"
    )
    stop_loss_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="止损价"
    )

    # 实际结果
    max_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="日内最高价"
    )
    min_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="日内最低价"
    )
    close_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="收盘价"
    )

    # 收益计算
    max_return_pct: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="最大收益%"
    )
    actual_return_pct: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="实际收益%"
    )

    # 成功判定
    success: Mapped[Optional[bool]] = mapped_column(
        nullable=True, comment="是否成功"
    )
    success_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="成功类型"
    )

    # 失败分析
    failure_reason: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="失败原因"
    )
    failure_analysis: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="详细分析"
    )

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    # 关联关系 - 移除了 back_populates 避免循环导入
    # 通过 signal_id 查询即可


class AgentLearning(Base):
    """Agent学习与优化记录表"""

    __tablename__ = "agent_learning"
    __table_args__ = (
        Index("idx_learning_date", "trade_date"),
        Index("idx_learning_type", "agent_type", "trade_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trade_date: Mapped[date] = mapped_column(nullable=False, comment="交易日期")
    agent_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="Agent类型"
    )

    # 当日统计
    total_signals: Mapped[int] = mapped_column(default=0, comment="总信号数")
    success_count: Mapped[int] = mapped_column(default=0, comment="成功数")
    failure_count: Mapped[int] = mapped_column(default=0, comment="失败数")
    success_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True, comment="成功率%"
    )

    # 权重调整
    old_weight: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True, comment="调整前权重"
    )
    new_weight: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True, comment="调整后权重"
    )
    adjustment_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="调整原因"
    )

    # 参数调整
    params_adjustment: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="参数调整JSON"
    )

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

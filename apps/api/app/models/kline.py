"""
K线数据模型
支持 TimescaleDB 时序扩展
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Numeric, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class KLine1Min(Base):
    """1分钟K线数据表 (TimescaleDB Hypertable)"""

    __tablename__ = "kline_1min"
    __table_args__ = (
        UniqueConstraint("time", "code", name="uq_kline_1min_time_code"),
        Index("idx_kline_1min_code_time", "code", "time"),
    )

    time: Mapped[datetime] = mapped_column(primary_key=True, comment="时间戳")
    code: Mapped[str] = mapped_column(primary_key=True, comment="股票代码")
    open: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="开盘价")
    high: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="最高价")
    low: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="最低价")
    close: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="收盘价")
    volume: Mapped[int] = mapped_column(nullable=False, comment="成交量（股）")
    amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, comment="成交金额（元）"
    )


class KLine5Min(Base):
    """5分钟K线数据表"""

    __tablename__ = "kline_5min"
    __table_args__ = (
        UniqueConstraint("time", "code", name="uq_kline_5min_time_code"),
        Index("idx_kline_5min_code_time", "code", "time"),
    )

    time: Mapped[datetime] = mapped_column(primary_key=True, comment="时间戳")
    code: Mapped[str] = mapped_column(primary_key=True, comment="股票代码")
    open: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="开盘价")
    high: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="最高价")
    low: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="最低价")
    close: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="收盘价")
    volume: Mapped[int] = mapped_column(nullable=False, comment="成交量（股）")
    amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, comment="成交金额（元）"
    )


class KLine1Day(Base):
    """日K线数据表"""

    __tablename__ = "kline_1d"
    __table_args__ = (
        UniqueConstraint("time", "code", name="uq_kline_1d_time_code"),
        Index("idx_kline_1d_code_time", "code", "time"),
    )

    time: Mapped[datetime] = mapped_column(primary_key=True, comment="日期")
    code: Mapped[str] = mapped_column(primary_key=True, comment="股票代码")
    open: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="开盘价")
    high: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="最高价")
    low: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="最低价")
    close: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, comment="收盘价")
    volume: Mapped[int] = mapped_column(nullable=False, comment="成交量（股）")
    amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, comment="成交金额（元）"
    )
    change_pct: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=True, comment="涨跌幅%"
    )

"""
技术指标数据模型
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Numeric, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Indicator(Base):
    """技术指标数据表（分钟级）"""

    __tablename__ = "indicators"
    __table_args__ = (
        UniqueConstraint("time", "code", name="uq_indicator_time_code"),
        Index("idx_indicator_code_time", "code", "time"),
    )

    time: Mapped[datetime] = mapped_column(primary_key=True, comment="时间戳")
    code: Mapped[str] = mapped_column(primary_key=True, comment="股票代码")

    # 移动平均线
    ma5: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="5日均线"
    )
    ma10: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="10日均线"
    )
    ma20: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="20日均线"
    )
    ma60: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="60日均线"
    )

    # MACD指标
    macd_dif: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="MACD DIF"
    )
    macd_dea: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="MACD DEA"
    )
    macd_hist: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True, comment="MACD 柱状图"
    )

    # KDJ指标
    kdj_k: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="KDJ K值"
    )
    kdj_d: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="KDJ D值"
    )
    kdj_j: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="KDJ J值"
    )

    # RSI指标
    rsi6: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="RSI 6"
    )
    rsi12: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="RSI 12"
    )
    rsi24: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="RSI 24"
    )

    # 成交量指标
    volume_ma5: Mapped[Optional[int]] = mapped_column(
        nullable=True, comment="成交量5日均值"
    )
    volume_ratio: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="量比"
    )

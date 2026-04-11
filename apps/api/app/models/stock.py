"""
股票基础信息模型
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import String, Date, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.signal import Signal


class Stock(Base):
    """股票基础信息表"""

    __tablename__ = "stocks"
    __table_args__ = (
        Index("idx_stock_market", "market"),
        Index("idx_stock_industry", "industry"),
    )

    code: Mapped[str] = mapped_column(String(20), primary_key=True, comment="股票代码")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="股票名称")
    market: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="市场: SH/SZ/BJ"
    )
    industry: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="所属行业"
    )
    list_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="上市日期"
    )

    def __repr__(self) -> str:
        return f"<Stock(code={self.code}, name={self.name})>"

    # 关联关系
    signals: Mapped[list["Signal"]] = relationship("Signal", back_populates="stock")

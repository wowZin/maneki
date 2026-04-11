"""
K线数据Schema
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class KLineBase(BaseModel):
    """K线基础"""

    time: datetime
    code: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    amount: Decimal


class KLineResponse(KLineBase):
    """K线响应"""

    class Config:
        from_attributes = True

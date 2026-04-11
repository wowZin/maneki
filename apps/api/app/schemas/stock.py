"""
股票相关Schema
"""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.base import PaginatedResponse, TimestampMixin


class StockBase(BaseModel):
    """股票基础"""

    code: str
    name: str
    market: str
    industry: Optional[str] = None
    list_date: Optional[date] = None


class StockResponse(StockBase, TimestampMixin):
    """股票响应"""

    class Config:
        from_attributes = True


class StockListResponse(PaginatedResponse[StockResponse]):
    """股票列表响应"""

    pass

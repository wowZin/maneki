"""
信号相关Schema
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional, Any

from pydantic import BaseModel


class SignalBase(BaseModel):
    """信号基础"""

    code: str
    signal_type: str  # buy/sell/watch/alert
    confidence: Decimal
    trigger_price: Optional[Decimal] = None
    reason: Optional[str] = None


class SignalResponse(SignalBase):
    """信号响应"""

    id: int
    created_at: datetime
    agents_votes: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    is_valid: bool = True

    class Config:
        from_attributes = True


class SignalListResponse(BaseModel):
    """信号列表响应"""

    items: list[SignalResponse]
    total: int

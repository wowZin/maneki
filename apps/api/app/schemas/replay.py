"""
复盘相关Schema
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class ReplayResultResponse(BaseModel):
    """复盘结果响应"""

    id: int
    trade_date: date
    code: str
    entry_price: Optional[Decimal]
    max_price: Optional[Decimal]
    min_price: Optional[Decimal]
    close_price: Optional[Decimal]
    max_return_pct: Optional[Decimal]
    actual_return_pct: Optional[Decimal]
    success: Optional[bool]
    success_type: Optional[str]
    failure_reason: Optional[str]

    class Config:
        from_attributes = True


class ReplaySummaryResponse(BaseModel):
    """复盘汇总响应"""

    trade_date: str
    total_signals: int
    success_count: int
    success_rate: float
    avg_max_return: float
    avg_actual_return: float


class AgentLearningResponse(BaseModel):
    """Agent学习记录响应"""

    id: int
    trade_date: date
    agent_type: str
    total_signals: int
    success_count: int
    success_rate: Optional[Decimal]
    new_weight: Optional[Decimal]
    adjustment_reason: Optional[str]

    class Config:
        from_attributes = True

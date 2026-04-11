"""
基础Schema
"""

from datetime import datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel):
    """API基础响应"""

    code: int = 200
    message: str = "success"


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应"""

    items: List[T]
    total: int
    skip: int = 0
    limit: int = 100


class TimestampMixin(BaseModel):
    """时间戳混入"""

    created_at: datetime
    updated_at: Optional[datetime] = None

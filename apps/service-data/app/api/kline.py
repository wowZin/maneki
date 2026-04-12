"""
K线数据 API
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from app.services.kline_service import get_kline

router = APIRouter()


class KLineRequest(BaseModel):
    code: str = Field(..., description="股票代码，如 000001")
    days: int = Field(default=30, ge=1, le=365, description="获取天数")
    source: Literal["auto", "tushare", "akshare"] = Field(
        default="auto",
        description="数据源: auto 自动选择, tushare, akshare"
    )


class KLineResponse(BaseModel):
    code: int = Field(..., description="0 表示成功，负数表示错误")
    data: list = Field(default=[], description="K线数据列表")
    source: str = Field(..., description="实际使用的数据源")
    message: str = Field(default="", description="错误信息")


@router.post("/kline", response_model=KLineResponse)
def get_kline_data(request: KLineRequest):
    """
    获取 K线数据
    
    支持 Tushare Pro 和 Akshare 双数据源，根据 source 参数自动选择
    """
    result = get_kline(
        code=request.code,
        days=request.days,
        source=request.source
    )
    return KLineResponse(**result)


@router.get("/kline/{code}")
def get_kline_get(
    code: str,
    days: int = 30,
    source: Literal["auto", "tushare", "akshare"] = "auto"
):
    """
    获取 K线数据 (GET 方式)
    """
    result = get_kline(
        code=code,
        days=days,
        source=source
    )
    return result

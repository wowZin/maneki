"""
股票相关API
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.stock import Stock
from app.models.kline import KLine1Min, KLine1Day
from app.schemas.stock import StockResponse, StockListResponse
from app.schemas.kline import KLineResponse
from app.services.data_collector import data_collector

router = APIRouter()


@router.get("/list", response_model=StockListResponse)
async def get_stock_list(
    db: AsyncSession = Depends(get_db),
    market: Optional[str] = Query(None, description="市场过滤: SH/SZ/BJ"),
    industry: Optional[str] = Query(None, description="行业过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """
    获取股票列表
    """
    query = select(Stock)

    if market:
        query = query.where(Stock.market == market)
    if industry:
        query = query.where(Stock.industry == industry)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    stocks = result.scalars().all()

    return {
        "items": stocks,
        "total": len(stocks),
        "skip": skip,
        "limit": limit,
    }


@router.get("/{code}", response_model=StockResponse)
async def get_stock_detail(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    获取股票详情
    """
    stock = await db.get(Stock, code)
    if not stock:
        raise HTTPException(status_code=404, detail="股票不存在")

    return stock


@router.get("/{code}/kline/min", response_model=List[KLineResponse])
async def get_kline_min(
    code: str,
    db: AsyncSession = Depends(get_db),
    days: int = Query(1, ge=1, le=14, description="天数"),
):
    """
    获取分钟K线数据
    """
    end_time = datetime.now()
    start_time = end_time - timedelta(days=days)

    query = select(KLine1Min).where(
        and_(
            KLine1Min.code == code,
            KLine1Min.time >= start_time,
            KLine1Min.time <= end_time,
        )
    ).order_by(KLine1Min.time)

    result = await db.execute(query)
    klines = result.scalars().all()

    return klines


@router.get("/{code}/kline/day", response_model=List[KLineResponse])
async def get_kline_day(
    code: str,
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    """
    获取日K线数据
    """
    end_time = datetime.now()
    start_time = end_time - timedelta(days=days)

    query = select(KLine1Day).where(
        and_(
            KLine1Day.code == code,
            KLine1Day.time >= start_time,
            KLine1Day.time <= end_time,
        )
    ).order_by(KLine1Day.time)

    result = await db.execute(query)
    klines = result.scalars().all()

    return klines


@router.post("/sync")
async def sync_stocks(
    db: AsyncSession = Depends(get_db),
):
    """
    同步股票列表（从数据源）
    管理接口，需要权限验证（TODO）
    """
    await data_collector.sync_stock_list()
    return {"message": "股票列表同步成功"}

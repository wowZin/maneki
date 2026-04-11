"""
复盘相关API
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.middleware import limiter
from app.models.replay import ReplayResult, AgentLearning
from app.schemas.replay import (
    ReplayResultResponse,
    ReplaySummaryResponse,
    AgentLearningResponse,
)
from app.services.replay_engine import replay_engine

router = APIRouter()


@router.get("/results", response_model=List[ReplayResultResponse])
async def get_replay_results(
    db: AsyncSession = Depends(get_db),
    trade_date: Optional[date] = Query(None, description="交易日期"),
    code: Optional[str] = Query(None, description="股票代码"),
    success: Optional[bool] = Query(None, description="是否成功"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """
    获取复盘结果列表
    """
    if not trade_date:
        trade_date = date.today() - timedelta(days=1)

    query = select(ReplayResult).where(ReplayResult.trade_date == trade_date)

    if code:
        query = query.where(ReplayResult.code == code)
    if success is not None:
        query = query.where(ReplayResult.success == success)

    query = query.order_by(desc(ReplayResult.max_return_pct)).offset(skip).limit(limit)

    result = await db.execute(query)
    results = result.scalars().all()

    return results


@router.get("/summary", response_model=ReplaySummaryResponse)
async def get_replay_summary(
    db: AsyncSession = Depends(get_db),
    trade_date: Optional[date] = Query(None, description="交易日期"),
):
    """
    获取复盘汇总统计
    """
    if not trade_date:
        trade_date = date.today() - timedelta(days=1)

    # 统计查询
    query = select(
        func.count(ReplayResult.id).label("total"),
        func.sum(func.cast(ReplayResult.success, func.Integer)).label("success_count"),
        func.avg(ReplayResult.max_return_pct).label("avg_max_return"),
        func.avg(ReplayResult.actual_return_pct).label("avg_actual_return"),
    ).where(ReplayResult.trade_date == trade_date)

    result = await db.execute(query)
    row = result.one()

    total = row.total or 0
    success_count = row.success_count or 0
    success_rate = (success_count / total * 100) if total > 0 else 0

    return {
        "trade_date": str(trade_date),
        "total_signals": total,
        "success_count": success_count,
        "success_rate": round(success_rate, 2),
        "avg_max_return": round(row.avg_max_return or 0, 2),
        "avg_actual_return": round(row.avg_actual_return or 0, 2),
    }


@router.get("/learning", response_model=List[AgentLearningResponse])
async def get_agent_learning(
    db: AsyncSession = Depends(get_db),
    trade_date: Optional[date] = Query(None, description="交易日期"),
    agent_type: Optional[str] = Query(None, description="Agent类型"),
):
    """
    获取Agent学习记录
    """
    if not trade_date:
        trade_date = date.today() - timedelta(days=1)

    query = select(AgentLearning).where(AgentLearning.trade_date == trade_date)

    if agent_type:
        query = query.where(AgentLearning.agent_type == agent_type)

    query = query.order_by(desc(AgentLearning.success_rate))

    result = await db.execute(query)
    records = result.scalars().all()

    return records


@router.post("/run")
@limiter.limit("10/hour")
async def run_replay(
    request: Request,
    trade_date: Optional[date] = Query(None, description="交易日期，默认昨天"),
):
    """
    手动触发复盘
    限流: 10次/小时（资源密集型操作）
    """
    try:
        report = await replay_engine.run_daily_replay(trade_date)
        return {
            "message": "复盘完成",
            "report": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"复盘失败: {str(e)}")


@router.get("/success-rate/history")
async def get_success_rate_history(
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1, le=30),
):
    """
    获取历史成功率趋势
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    query = select(
        ReplayResult.trade_date,
        func.count(ReplayResult.id).label("total"),
        func.sum(func.cast(ReplayResult.success, func.Integer)).label("success_count"),
    ).where(
        ReplayResult.trade_date >= start_date,
        ReplayResult.trade_date <= end_date,
    ).group_by(ReplayResult.trade_date).order_by(ReplayResult.trade_date)

    result = await db.execute(query)
    rows = result.all()

    history = []
    for row in rows:
        total = row.total or 0
        success = row.success_count or 0
        rate = (success / total * 100) if total > 0 else 0
        history.append({
            "date": str(row.trade_date),
            "total": total,
            "success": success,
            "rate": round(rate, 2),
        })

    return {"history": history}

"""
信号相关API
包括SSE实时推送
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.middleware import limiter
from app.models.signal import Signal
from app.schemas.signal import SignalResponse, SignalListResponse
from app.services.real_time_engine import real_time_engine
from app.services.signal_generator import signal_generator
from app.agents.coordinator import coordinator
from app.services.data_collector import data_collector

router = APIRouter()

# 信号队列（用于SSE推送）
signal_queue: asyncio.Queue = asyncio.Queue()


@router.get("/list", response_model=SignalListResponse)
async def get_signals(
    db: AsyncSession = Depends(get_db),
    code: Optional[str] = Query(None, description="股票代码过滤"),
    signal_type: Optional[str] = Query(None, description="信号类型: buy/sell/watch"),
    days: int = Query(1, ge=1, le=14),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """
    获取历史信号列表
    """
    end_time = datetime.now()
    start_time = end_time - timedelta(days=days)

    query = select(Signal).where(Signal.created_at >= start_time)

    if code:
        query = query.where(Signal.code == code)
    if signal_type:
        query = query.where(Signal.signal_type == signal_type)

    query = query.order_by(desc(Signal.created_at)).offset(skip).limit(limit)

    result = await db.execute(query)
    signals = result.scalars().all()

    # 统计总数
    count_query = select(Signal).where(Signal.created_at >= start_time)
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return {
        "items": signals,
        "total": total,
    }


@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal_detail(
    signal_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    获取信号详情
    """
    signal = await db.get(Signal, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="信号不存在")

    return signal


async def signal_generator_sse():
    """
    SSE 信号生成器
    监听信号队列，有新信号时推送给客户端
    """
    while True:
        try:
            # 从队列获取信号（非阻塞，5秒超时发送心跳）
            signal = await asyncio.wait_for(signal_queue.get(), timeout=5.0)

            # SSE 格式
            yield f"event: signal\ndata: {json.dumps(signal, ensure_ascii=False)}\n\n"

        except asyncio.TimeoutError:
            # 发送心跳保持连接
            yield f"event: ping\ndata: {{}}\n\n"


@router.get("/sse/stream")
@limiter.limit("30/minute")
async def sse_signals(request: Request):
    """
    SSE 决策信号推送端点

    前端使用 EventSource 连接此端点接收实时决策通知
    限流: 30次/分钟（防止过多并发连接）
    """
    return StreamingResponse(
        signal_generator_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


async def push_signal_to_queue(signal_data: dict):
    """
    推送信号到队列（由Agent系统调用）
    """
    await signal_queue.put(signal_data)


@router.post("/analyze/{code}")
@limiter.limit("30/minute")
async def analyze_stock(
    request: Request,  # slowapi 需要 request 参数
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    手动触发单只股票分析（测试用）
    限流: 30次/分钟（资源密集型操作）
    """
    # 获取实时行情
    quotes = await data_collector.get_realtime_quotes([code])

    if code not in quotes:
        raise HTTPException(status_code=404, detail="无法获取股票行情")

    quote = quotes[code]

    # 获取K线数据
    klines = await data_collector.get_stock_kline_min(code, period="1", days=1)

    if not klines:
        raise HTTPException(status_code=404, detail="无法获取K线数据")

    # 计算指标
    indicator = await real_time_engine.calculate_indicators(code, klines)

    if not indicator:
        raise HTTPException(status_code=500, detail="指标计算失败")

    # Agent讨论决策
    signal = await coordinator.discuss_and_decide(
        code=code,
        current_price=quote['price'],
        indicator_data={
            'ma5': float(indicator.ma5) if indicator.ma5 else None,
            'ma10': float(indicator.ma10) if indicator.ma10 else None,
            'ma20': float(indicator.ma20) if indicator.ma20 else None,
            'macd_hist': float(indicator.macd_hist) if indicator.macd_hist else None,
            'kdj_k': float(indicator.kdj_k) if indicator.kdj_k else None,
            'kdj_d': float(indicator.kdj_d) if indicator.kdj_d else None,
            'rsi6': float(indicator.rsi6) if indicator.rsi6 else None,
            'volume_ma5': indicator.volume_ma5,
        },
        change_pct=quote['change_pct'],
        volume=quote['volume'],
    )

    if signal:
        # 推送到SSE队列
        await push_signal_to_queue({
            "id": signal.id,
            "code": signal.code,
            "type": signal.signal_type,
            "confidence": float(signal.confidence),
            "reason": signal.reason,
            "time": signal.created_at.isoformat(),
        })

        return {
            "message": "分析完成",
            "signal": {
                "id": signal.id,
                "type": signal.signal_type,
                "confidence": float(signal.confidence),
            }
        }

    return {"message": "未生成信号"}


# 添加导入
from fastapi import HTTPException

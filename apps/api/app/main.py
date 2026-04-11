"""
Maneki API - 股票分析智能应用后端
基于 FastAPI 的高性能异步 API
"""

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.db.session import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Maneki API 启动中...")
    print(f"📊 配置: 监控{settings.MONITOR_STOCK_COUNT}只股票, 保留{settings.DATA_RETENTION_DAYS}天")

    # 初始化数据库
    try:
        await init_db()
        print("✅ 数据库初始化完成")
    except Exception as e:
        print(f"⚠️ 数据库初始化失败: {e}")

    yield

    # 关闭时执行
    print("👋 Maneki API 关闭中...")
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    description="股票分析智能应用 - 基于多Agent决策的实时涨停预测系统",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "features": [
            "real-time-stock-monitoring",
            "multi-agent-decision",
            "signal-generation",
            "replay-analysis",
        ]
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
    }


# 导入路由
from app.api.v1 import stocks, signals, replay
from datetime import datetime

# 注册路由
app.include_router(stocks.router, prefix="/api/v1/stocks", tags=["stocks"])
app.include_router(signals.router, prefix="/api/v1/signals", tags=["signals"])
app.include_router(replay.router, prefix="/api/v1/replay", tags=["replay"])


@app.get("/api/v1/sse/signals")
async def sse_signals(request: Request):
    """
    SSE 决策信号推送端点（备用，也可以在signals模块中定义）
    """
    from app.api.v1.signals import signal_generator_sse

    return StreamingResponse(
        signal_generator_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

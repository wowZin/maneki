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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Maneki API 启动中...")
    # TODO: 初始化数据库连接、Redis连接等
    yield
    # 关闭时执行
    print("👋 Maneki API 关闭中...")
    # TODO: 关闭连接池等


app = FastAPI(
    title="Maneki API",
    description="股票分析智能应用 - 基于多Agent决策的实时涨停预测系统",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 前端开发服务器
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Maneki API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


# ========== SSE 决策通知推送端点 ==========

# 模拟信号队列（实际项目中应使用 Redis/RabbitMQ）
signal_queue = asyncio.Queue()


async def signal_generator():
    """
    SSE 信号生成器
    监听信号队列，有新信号时推送给客户端
    """
    while True:
        try:
            # 从队列获取信号（非阻塞，5秒超时发送心跳）
            signal = await asyncio.wait_for(signal_queue.get(), timeout=5.0)

            # SSE 格式：event: <event_name>\ndata: <json_data>\n\n
            yield f"event: signal\ndata: {json.dumps(signal, ensure_ascii=False)}\n\n"

        except asyncio.TimeoutError:
            # 发送心跳保持连接
            yield f"event: ping\ndata: {{}}\n\n"


@app.get("/sse/signals")
async def sse_signals(request: Request):
    """
    SSE 决策信号推送端点

    前端使用 EventSource 连接此端点接收实时决策通知：

    ```javascript
    const source = new EventSource('/sse/signals');
    source.addEventListener('signal', (e) => {
        const signal = JSON.parse(e.data);
        console.log('收到信号:', signal);
    });
    ```
    """
    return StreamingResponse(
        signal_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        }
    )


# TODO: 后续从 Agent 决策器推送信号到队列
async def push_signal_example():
    """示例：模拟推送信号（实际应由 Agent 系统调用）"""
    await asyncio.sleep(5)  # 5秒后推送测试信号
    await signal_queue.put({
        "id": "signal_001",
        "type": "buy",
        "code": "000001",
        "confidence": 0.85,
        "time": "2024-04-11T10:30:00",
        "reason": "技术指标突破"
    })


# 启动时运行示例（仅用于测试）
# @app.on_event("startup")
# async def startup_event():
#     asyncio.create_task(push_signal_example())


# TODO: 后续添加路由
# from app.api.v1 import stocks, signals, decisions, replay
# app.include_router(stocks.router, prefix="/api/v1/stocks", tags=["stocks"])
# app.include_router(signals.router, prefix="/api/v1/signals", tags=["signals"])
# app.include_router(decisions.router, prefix="/api/v1/decisions", tags=["decisions"])
# app.include_router(replay.router, prefix="/api/v1/replay", tags=["replay"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

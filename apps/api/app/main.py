"""
Maneki API - 股票分析智能应用后端
基于 FastAPI 的高性能异步 API
"""

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.security import ip_whitelist
from app.db.session import init_db, close_db
from app.middleware import RateLimitMiddleware, RequestLogMiddleware, limiter
from app.middleware.security import (
    SecurityHeadersMiddleware,
    AdminIPWhitelistMiddleware,
    RequestAuditMiddleware,
    APISecurityMiddleware,
)


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

    # 初始化 IP 白名单
    for ip_range in settings.ADMIN_IP_WHITELIST.split(","):
        ip_whitelist.add_ip(ip_range.strip())
    print(f"✅ Admin IP 白名单已加载: {len(ip_whitelist.whitelist)} 个网段")

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

# ========== API Gateway 中间件配置 ==========

# 0. API 安全检查中间件（最先执行）
app.add_middleware(APISecurityMiddleware)

# 1. 安全响应头中间件
app.add_middleware(SecurityHeadersMiddleware)

# 2. 请求日志中间件（记录完整请求）
app.add_middleware(
    RequestLogMiddleware,
    log_level=settings.LOG_LEVEL,
    slow_request_threshold=1.0,  # 超过1秒的请求标记为慢请求
)

# 3. Admin IP 白名单中间件
app.add_middleware(AdminIPWhitelistMiddleware)

# 4. 审计日志中间件
app.add_middleware(RequestAuditMiddleware)

# 5. CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-CSRF-Token"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=600,
)

# 6. 限流中间件
app.add_middleware(RateLimitMiddleware)

# 4. 注册 slowapi 限流器
app.state.limiter = limiter


# 自定义限流错误处理
def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """限流超限自定义响应"""
    retry_after = int(exc.detail.split(" ").pop()) if hasattr(exc, "detail") else 60

    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "请求过于频繁，请稍后再试",
            "retry_after": retry_after,
            "limit": exc.limit if hasattr(exc, "limit") else "unknown",
        },
        headers={
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit": str(exc.limit) if hasattr(exc, "limit") else "",
            "X-RateLimit-Reset": str(retry_after),
        },
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


@app.get("/")
@limiter.limit("10/minute")
async def root(request: Request):
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
        ],
        "gateway": {
            "rate_limiting": "enabled",
            "request_logging": "enabled",
            "authentication": "enabled",
        }
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "gateway": {
            "rate_limiting": "enabled",
            "request_logging": "enabled",
            "authentication": "enabled",
        },
    }


@app.get("/gateway/status")
@limiter.limit("30/minute")
async def gateway_status(request: Request):
    """
    API Gateway 状态查询
    返回网关配置和限流状态
    """
    return {
        "gateway": "Maneki API Gateway",
        "version": settings.APP_VERSION,
        "features": {
            "rate_limiting": {
                "enabled": True,
                "default": "100/minute",
                "storage": "redis",
                "strategy": "fixed-window",
            },
            "request_logging": {
                "enabled": True,
                "level": settings.LOG_LEVEL,
                "slow_threshold": "1.0s",
            },
            "authentication": {
                "enabled": True,
                "methods": ["jwt", "wechat_mp", "wechat_mini"],
            },
            "cors": {
                "enabled": True,
                "origins": settings.CORS_ORIGINS,
            },
        },
        "endpoints": {
            "public": ["/", "/health", "/gateway/status", "/api/v1/auth/login", "/api/v1/auth/register"],
            "protected": ["/api/v1/stocks/*", "/api/v1/signals/*", "/api/v1/replay/*"],
            "sse": ["/api/v1/signals/sse/stream", "/api/v1/sse/signals"],
        },
        "rate_limits": {
            "/api/v1/auth/jwt/login": "5/minute",
            "/api/v1/wechat/*": "5/minute",
            "/api/v1/signals/analyze/*": "30/minute",
            "/api/v1/signals/sse/stream": "30/minute",
            "/api/v1/replay/run": "10/hour",
            "/api/v1/stocks/sync": "10/hour",
            "default": "100/minute",
        },
    }


# 导入路由
from app.api.v1 import stocks, signals, replay, auth, wechat, pricing, admin, agent_market, agent_weights, market_data
from datetime import datetime

# 注册认证路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

# 注册微信认证路由
app.include_router(wechat.router, prefix="/api/v1/wechat", tags=["wechat"])

# 注册定价路由
app.include_router(pricing.router, prefix="/api/v1/pricing", tags=["pricing"])

# 注册业务路由
app.include_router(stocks.router, prefix="/api/v1/stocks", tags=["stocks"])
app.include_router(signals.router, prefix="/api/v1/signals", tags=["signals"])
app.include_router(replay.router, prefix="/api/v1/replay", tags=["replay"])

# 注册行情数据路由
app.include_router(market_data.router, prefix="/api/v1/market", tags=["market-data"])

# 注册 Agent 市场路由
app.include_router(agent_market.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(agent_weights.router, prefix="/api/v1/agent-weights", tags=["agent-weights"])

# 注册管理后台路由（仅管理员可访问）
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])


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

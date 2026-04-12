"""
Data Service - 统一数据服务

提供功能：
1. 实时数据 API (K线等)
2. 定时同步任务 (新闻/舆情等低频数据)
"""
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from loguru import logger

from app.core import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
    
    # Initialize database
    try:
        from app.db.init_db import init_db
        init_db()
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}")

    # Initialize services
    from app.services.data_source import init_data_sources
    init_data_sources()
    
    # Start scheduler if enabled
    if settings.ENABLE_SCHEDULER:
        from app.tasks.scheduler import start_scheduler
        start_scheduler()
        logger.info("Scheduler started")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.SERVICE_NAME}")
    
    if settings.ENABLE_SCHEDULER:
        from app.tasks.scheduler import stop_scheduler
        stop_scheduler()


app = FastAPI(
    title="Data Service",
    description="统一数据服务 - 支持 Tushare Pro & Akshare",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan
)


@app.get("/health")
def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION
    }


# Import and include routers
from app.api import kline, news, admin

app.include_router(kline.router, prefix="/api", tags=["kline"])
app.include_router(news.router, prefix="/api", tags=["news"])
app.include_router(admin.router, prefix="/api", tags=["admin"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

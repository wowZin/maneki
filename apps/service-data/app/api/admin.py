"""
管理 API
用于手动触发同步任务和查看服务状态
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

router = APIRouter()


class SyncRequest(BaseModel):
    codes: Optional[List[str]] = Field(None, description="股票代码列表，为空则同步全部")
    days: int = Field(default=30, ge=1, le=365, description="同步天数")
    source: str = Field(default="tushare", description="数据源")


class SyncResponse(BaseModel):
    code: int = Field(..., description="0 表示成功")
    message: str = Field(..., description="消息")
    data: dict = Field(default={}, description="详细结果")


@router.post("/admin/sync/kline", response_model=SyncResponse)
def sync_kline_manual(request: SyncRequest):
    """
    手动触发 K线数据同步
    
    用于测试或补充同步
    """
    from app.services.sync_service import sync_all_kline, sync_kline_for_code
    
    try:
        if request.codes:
            # 同步指定股票
            results = []
            for code in request.codes:
                result = sync_kline_for_code(code, request.days, request.source)
                results.append(result)
            
            success_count = sum(1 for r in results if r["success"])
            return SyncResponse(
                code=0,
                message=f"Sync completed: {success_count}/{len(results)} success",
                data={"details": results}
            )
        else:
            # 同步全部
            result = sync_all_kline(days=request.days, source=request.source)
            return SyncResponse(
                code=0,
                message=f"Batch sync completed: {result['success']}/{result['total']} success",
                data=result
            )
    
    except Exception as e:
        return SyncResponse(
            code=-1,
            message=f"Sync failed: {str(e)}",
            data={}
        )


@router.post("/admin/sync/stock-basic", response_model=SyncResponse)
def sync_stock_basic_manual():
    """
    手动触发股票基础信息同步
    """
    from app.services.sync_service import sync_stock_basic
    
    try:
        result = sync_stock_basic()
        return SyncResponse(
            code=0 if result["success"] else -1,
            message=f"Stock basic sync: {result.get('count', 0)} records",
            data=result
        )
    except Exception as e:
        return SyncResponse(
            code=-1,
            message=f"Sync failed: {str(e)}",
            data={}
        )


@router.get("/admin/status")
def get_service_status():
    """
    获取服务状态
    """
    from app.services.data_source import get_tushare_pro
    
    tushare_available = get_tushare_pro() is not None
    
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "tushare_pro": "available" if tushare_available else "unavailable",
            "akshare": "available",  # Akshare 不需要初始化
        }
    }


@router.get("/admin/stats")
def get_data_stats():
    """
    获取数据统计
    """
    from app.db.database import SessionLocal
    from app.db.models import KLine, News

    try:
        db = SessionLocal()

        # K线数据统计
        kline_count = db.query(KLine).count()

        # 新闻统计
        news_count = db.query(News).count()

        # 获取日期范围
        latest_date = db.query(KLine.date).order_by(KLine.date.desc()).first()
        earliest_date = db.query(KLine.date).order_by(KLine.date.asc()).first()

        # 股票数量
        stock_count = db.query(KLine.code).distinct().count()

        db.close()

        return {
            "code": 0,
            "data": {
                "kline_total": kline_count,
                "news_total": news_count,
                "stock_count": stock_count,
                "date_range": {
                    "earliest": earliest_date[0] if earliest_date else None,
                    "latest": latest_date[0] if latest_date else None
                }
            }
        }
    except Exception as e:
        return {
            "code": -1,
            "message": str(e)
        }


@router.post("/admin/sync/news", response_model=SyncResponse)
def sync_news_manual():
    """
    手动触发新闻同步到数据库

    用于测试或补充同步
    """
    from app.services.news_sync_service import sync_news_to_db

    try:
        result = sync_news_to_db()
        return SyncResponse(
            code=0,
            message=f"News sync completed: {result['inserted']}/{result['total']} inserted",
            data=result
        )
    except Exception as e:
        return SyncResponse(
            code=-1,
            message=f"Sync failed: {str(e)}",
            data={}
        )

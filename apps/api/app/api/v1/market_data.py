"""
行情数据 API
支持多数据源，根据用户等级自动切换
本地缓存优先，提升稳定性
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.db.session import get_db_session
from app.models.user import User
from app.services.data_provider import get_data_provider, get_stock_data
from app.services.data_sync import DataSyncService
from app.tasks.data_sync import sync_historical_data

router = APIRouter()


@router.get("/data-source")
async def get_data_source_info(
    current_user: User = Depends(current_active_user),
):
    """
    获取当前用户使用的数据源信息

    - 免费用户：Akshare（免费，3秒延迟）
    - VIP/SVIP：Tushare Pro（付费，更稳定）
    """
    provider = get_data_provider()
    source = provider.get_data_source(current_user)

    return {
        "current_source": source.name if source else None,
        "available_sources": provider.available_sources,
        "user_vip_level": current_user.vip_level,
        "is_vip": current_user.is_vip,
        "strategy": settings.DATA_SOURCE_STRATEGY,
        "source_details": {
            "akshare": {
                "name": "Akshare",
                "description": "免费数据源，基于东方财富",
                "delay": "3秒",
                "requires_vip": False,
            },
            "tushare": {
                "name": "Tushare Pro",
                "description": "专业数据源，更稳定可靠",
                "delay": "实时",
                "requires_vip": True,
                "enabled": settings.TUSHARE_ENABLED,
            },
        },
    }


@router.get("/stocks")
async def get_stock_list(
    current_user: User = Depends(current_active_user),
):
    """获取股票列表"""
    provider = get_data_provider()
    source = provider.get_data_source(current_user)

    if not source:
        raise HTTPException(status_code=503, detail="数据源不可用")

    stocks = await source.get_stock_list()
    return {
        "count": len(stocks),
        "stocks": stocks[:100],  # 限制返回数量
        "data_source": source.name,
    }


@router.get("/kline/{code}")
async def get_kline(
    code: str,
    period: str = Query("daily", description="周期: daily/weekly/monthly/minutely"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYYMMDD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYYMMDD"),
    adjust: str = Query("qfq", description="复权: qfq=前复权, hfq=后复权, 空=不复权"),
    force_refresh: bool = Query(False, description="强制刷新，跳过本地缓存"),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """
    获取K线数据

    数据获取策略（日线数据）：
    1. 优先从本地数据库获取近14天数据
    2. 本地数据不完整时，异步触发同步任务
    3. 超过14天的数据或强制刷新时，从外部API获取

    自动根据用户等级选择数据源：
    - 免费用户：使用 Akshare
    - VIP/SVIP：使用 Tushare Pro
    """
    # 解析日期
    if end_date is None:
        end_dt = datetime.now()
    else:
        end_dt = datetime.strptime(end_date, "%Y%m%d")

    if start_date is None:
        start_dt = end_dt - timedelta(days=14)
    else:
        start_dt = datetime.strptime(start_date, "%Y%m%d")

    days_range = (end_dt - start_dt).days

    # 日线数据且14天内且非强制刷新：使用本地数据
    if period == "daily" and days_range <= 14 and not force_refresh:
        sync_service = DataSyncService(db)
        local_data = await sync_service.get_local_kline(
            code=code,
            days=days_range,
            end_date=end_dt
        )

        if len(local_data) >= int(days_range * 0.5):  # 至少有50%数据
            return {
                "code": code,
                "period": period,
                "count": len(local_data),
                "data_source": "local",
                "data": local_data,
            }

    # 其他情况：从外部API获取
    provider = get_data_provider()
    source = provider.get_data_source(current_user)

    if not source:
        raise HTTPException(status_code=503, detail="数据源不可用")

    try:
        klines = await source.get_kline(
            code=code,
            period=period,
            start_date=start_date,
            end_date=end_date,
            adjust=adjust,
        )

        return {
            "code": code,
            "period": period,
            "count": len(klines),
            "data_source": source.name,
            "data": [
                {
                    "timestamp": k.timestamp.isoformat(),
                    "open": float(k.open),
                    "high": float(k.high),
                    "low": float(k.low),
                    "close": float(k.close),
                    "volume": k.volume,
                    "amount": float(k.amount) if k.amount else None,
                }
                for k in klines
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取数据失败: {str(e)}")


@router.get("/quote/{code}")
async def get_realtime_quote(
    code: str,
    current_user: User = Depends(current_active_user),
):
    """获取实时行情"""
    provider = get_data_provider()
    source = provider.get_data_source(current_user)

    if not source:
        raise HTTPException(status_code=503, detail="数据源不可用")

    try:
        quote = await source.get_realtime_quote(code)

        if not quote:
            raise HTTPException(status_code=404, detail="股票不存在或暂无数据")

        return {
            "code": quote.code,
            "name": quote.name,
            "timestamp": quote.timestamp.isoformat(),
            "open": float(quote.open),
            "high": float(quote.high),
            "low": float(quote.low),
            "close": float(quote.close),
            "volume": quote.volume,
            "amount": float(quote.amount) if quote.amount else None,
            "change_pct": float(quote.change_pct) if quote.change_pct else None,
            "data_source": source.name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取行情失败: {str(e)}")


@router.get("/quotes")
async def get_realtime_quotes(
    codes: str = Query(..., description="股票代码列表，逗号分隔，如: 000001,000002"),
    current_user: User = Depends(current_active_user),
):
    """批量获取实时行情"""
    code_list = [c.strip() for c in codes.split(",")]

    if len(code_list) > 50:
        raise HTTPException(status_code=400, detail="最多查询50只股票")

    provider = get_data_provider()
    source = provider.get_data_source(current_user)

    if not source:
        raise HTTPException(status_code=503, detail="数据源不可用")

    try:
        quotes = await source.get_realtime_quotes(code_list)

        return {
            "count": len(quotes),
            "data_source": source.name,
            "data": [
                {
                    "code": q.code,
                    "name": q.name,
                    "close": float(q.close),
                    "change_pct": float(q.change_pct) if q.change_pct else None,
                    "volume": q.volume,
                }
                for q in quotes
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取行情失败: {str(e)}")


@router.get("/health")
async def data_source_health_check(
    current_user: User = Depends(current_active_user),
):
    """数据源健康检查（仅管理员）"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="仅管理员可用")

    provider = get_data_provider()
    health = await provider.health_check()

    return {
        "status": "healthy" if any(health.values()) else "unhealthy",
        "sources": health,
    }


@router.post("/sync")
async def trigger_data_sync(
    code: Optional[str] = Query(None, description="指定股票代码，不传则同步所有关注股票"),
    days: int = Query(14, description="同步天数"),
    current_user: User = Depends(current_active_user),
):
    """
    触发数据同步（仅管理员）

    手动触发历史数据同步任务，用于：
    - 初始化数据
    - 补充缺失数据
    - 强制刷新
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="仅管理员可用")

    # 提交异步任务
    if code:
        task = sync_historical_data.delay(days=days, stock_codes=[code])
    else:
        task = sync_historical_data.delay(days=days)

    return {
        "status": "accepted",
        "task_id": task.id,
        "message": "数据同步任务已提交",
        "params": {
            "code": code,
            "days": days,
        },
    }


@router.get("/sync/status")
async def get_sync_status(
    code: str = Query(..., description="股票代码"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """
    获取数据同步状态

    返回该股票在本地数据库的数据完整性情况
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func

    end_date = datetime.now()
    start_date = end_date - timedelta(days=14)

    # 查询本地数据
    from sqlalchemy import select, and_
    from app.models.kline import KLine1Day

    result = await db.execute(
        select(func.count(KLine1Day.id)).where(
            and_(
                KLine1Day.code == code,
                KLine1Day.timestamp >= start_date,
                KLine1Day.timestamp <= end_date
            )
        )
    )
    count = result.scalar()

    # 查询最新数据日期
    result = await db.execute(
        select(KLine1Day.timestamp).where(
            KLine1Day.code == code
        ).order_by(KLine1Day.timestamp.desc()).limit(1)
    )
    latest = result.scalar()

    return {
        "code": code,
        "local_data_count": count,
        "expected_count": 14,  # 近14个交易日
        "completeness": f"{min(count / 14 * 100, 100):.1f}%",
        "latest_data_date": latest.isoformat() if latest else None,
        "is_complete": count >= 10,  # 至少10个交易日认为完整
    }

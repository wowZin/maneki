"""
新闻/舆情数据 API

新闻数据是低频数据（交易日 8 点、12 点更新），
使用 Akshare 免费数据源
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.services.news_service import (
    get_major_news,
    get_stock_news,
    get_sentiment_data,
    get_sector_sentiment,
    load_from_offline_storage,
    save_to_offline_storage
)

router = APIRouter()


class NewsResponse(BaseModel):
    code: int = Field(..., description="0 表示成功")
    data: list = Field(default=[], description="新闻列表")
    date: str = Field(..., description="数据日期")
    source: str = Field(default="akshare", description="数据来源")


class SentimentResponse(BaseModel):
    code: int = Field(..., description="0 表示成功")
    data: dict = Field(default={}, description="情绪数据")
    date: str = Field(..., description="数据日期")


@router.get("/news/major", response_model=NewsResponse)
def get_major_news_api(
    date: Optional[str] = Query(None, description="日期 (YYYYMMDD)，默认为今天"),
    use_offline: bool = Query(True, description="是否优先从离线存储读取")
):
    """
    获取重大新闻
    
    优先从离线存储读取，如果没有则实时获取
    使用 Akshare 免费数据源
    """
    if not date:
        date = datetime.now().strftime("%Y%m%d")
    
    # 优先从离线存储读取
    if use_offline:
        offline_data = load_from_offline_storage("news", date)
        if offline_data:
            return NewsResponse(
                code=0,
                data=offline_data.get("news", []),
                date=date,
                source="offline"
            )
    
    # 实时获取（从 Akshare）
    news = get_major_news()
    return NewsResponse(
        code=0,
        data=news,
        date=date,
        source="akshare"
    )


@router.get("/news/stock/{symbol}", response_model=NewsResponse)
def get_stock_news_api(
    symbol: str,
    use_offline: bool = Query(False, description="是否优先从离线存储读取（默认实时）")
):
    """
    获取个股相关新闻
    
    Args:
        symbol: 股票代码，如 "000001"
    """
    # 个股新闻通常实时获取
    news = get_stock_news(symbol)
    
    return NewsResponse(
        code=0,
        data=news,
        date=datetime.now().strftime("%Y%m%d"),
        source="akshare"
    )


@router.get("/sentiment", response_model=SentimentResponse)
def get_sentiment_api(
    date: Optional[str] = Query(None, description="日期 (YYYYMMDD)"),
    use_offline: bool = Query(True, description="是否优先从离线存储读取")
):
    """
    获取市场情绪数据
    
    基于涨跌停数据计算市场情绪
    优先从离线存储读取
    """
    if not date:
        date = datetime.now().strftime("%Y%m%d")
    
    # 优先从离线存储读取
    if use_offline:
        offline_data = load_from_offline_storage("sentiment", date)
        if offline_data:
            return SentimentResponse(
                code=0,
                data=offline_data,
                date=date
            )
    
    # 实时获取（从 Akshare）
    data = get_sentiment_data(date)
    return SentimentResponse(
        code=0,
        data=data,
        date=date
    )


@router.get("/sentiment/sector")
def get_sector_sentiment_api(
    use_offline: bool = Query(True, description="是否优先从离线存储读取")
):
    """
    获取板块情绪数据
    """
    date = datetime.now().strftime("%Y%m%d")
    
    # 优先从离线存储读取
    if use_offline:
        offline_data = load_from_offline_storage("sector_sentiment", date)
        if offline_data:
            return {
                "code": 0,
                "data": offline_data,
                "date": date,
                "source": "offline"
            }
    
    # 实时获取
    data = get_sector_sentiment()
    return {
        "code": 0,
        "data": data,
        "date": date,
        "source": "akshare"
    }


@router.get("/news/sync")
def trigger_news_sync():
    """
    手动触发新闻数据同步（用于测试）
    
    实际应由定时任务自动执行
    """
    try:
        date = datetime.now().strftime("%Y%m%d")
        
        # 获取新闻
        news = get_major_news()
        
        # 获取情绪
        sentiment = get_sentiment_data(date)
        
        # 获取板块情绪
        sector = get_sector_sentiment()
        
        # 保存到离线存储
        news_saved = save_to_offline_storage(
            {"news": news, "sync_time": datetime.now().isoformat()},
            "news",
            date
        )
        
        sentiment_saved = save_to_offline_storage(
            sentiment,
            "sentiment",
            date
        )
        
        sector_saved = save_to_offline_storage(
            sector,
            "sector_sentiment",
            date
        ) if sector else False
        
        return {
            "code": 0,
            "message": "Sync triggered",
            "date": date,
            "news_count": len(news),
            "news_saved": news_saved,
            "sentiment_saved": sentiment_saved,
            "sector_saved": sector_saved
        }
    
    except Exception as e:
        return {
            "code": -1,
            "message": f"Sync failed: {str(e)}"
        }

"""
新闻/舆情数据服务

特性：
- 低频数据（交易日 8 点、12 点更新）
- 使用 Akshare 免费数据源
- 适合存储到离线存储（OSS/本地文件）
- Agent 分析时直接读取
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
import os
import re
import akshare as ak
import pandas as pd
from loguru import logger

from app.core import settings


def format_datetime(dt_str: str) -> str:
    """
    将各种日期时间格式统一格式化为 YYYY-MM-dd HH:mm

    支持的输入格式：
    - 2024-01-15 08:30:00
    - 2024/01/15 08:30
    - 2024年01月15日 08:30
    - 2024-01-15T08:30:00
    """
    if not dt_str or dt_str == 'nan':
        return ''

    dt_str = str(dt_str).strip()

    # 尝试解析各种格式
    patterns = [
        # 标准格式
        (r'^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$', '%Y-%m-%d %H:%M:%S'),
        (r'^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$', '%Y-%m-%d %H:%M'),
        # 斜杠格式
        (r'^(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$', '%Y/%m/%d %H:%M:%S'),
        (r'^(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2})$', '%Y/%m/%d %H:%M'),
        # 中文格式
        (r'^(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2}):(\d{2})$', '%Y年%m月%d日 %H:%M:%S'),
        (r'^(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})$', '%Y年%m月%d日 %H:%M'),
        # ISO 格式
        (r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})', '%Y-%m-%dT%H:%M:%S'),
    ]

    for pattern, fmt in patterns:
        if re.match(pattern, dt_str):
            try:
                dt = datetime.strptime(dt_str[:len(fmt.replace('%', ''))], fmt)
                return dt.strftime('%Y-%m-%d %H:%M')
            except ValueError:
                continue

    # 如果都不匹配，尝试 pandas 解析
    try:
        dt = pd.to_datetime(dt_str)
        return dt.strftime('%Y-%m-%d %H:%M')
    except:
        pass

    # 返回原始值（无法解析时）
    return dt_str


def get_major_news(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    src: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    获取重大新闻
    
    使用 Akshare 的财经新闻接口
    
    Args:
        start_date: 开始日期 (YYYYMMDD)
        end_date: 结束日期 (YYYYMMDD)
        src: 来源（Akshare 支持多个财经网站）
            - "sina": 新浪财经
            - "eastmoney": 东方财富
            - "10jqka": 同花顺
            - "yicai": 第一财经
    
    Returns:
        新闻列表
    """
    try:
        # 默认获取新浪财经的新闻
        news_src = src or "sina"
        
        # Akshare 接口获取财经新闻
        if news_src == "sina":
            df = ak.stock_news_em()  # 东方财富财经新闻
        elif news_src == "eastmoney":
            df = ak.stock_news_em()
        else:
            # 默认使用东方财富
            df = ak.stock_news_em()
        
        if df is None or df.empty:
            logger.warning("No news data returned from akshare")
            return []
        
        # 转换为标准格式
        result = []
        for _, row in df.head(100).iterrows():  # 取最新 100 条
            # 处理日期格式，统一格式化为 YYYY-MM-dd HH:mm
            datetime_str = format_datetime(str(row.get("datetime", "")))

            result.append({
                "datetime": datetime_str,
                "title": str(row.get("title", "")),
                "content": str(row.get("content", "")),
                "url": str(row.get("url", "")),
                "src": news_src
            })

        return result
    
    except Exception as e:
        logger.error(f"Failed to get major news: {e}")
        return []


def get_stock_news(symbol: str = "000001") -> List[Dict[str, Any]]:
    """
    获取个股相关新闻
    
    Args:
        symbol: 股票代码，如 "000001"
    
    Returns:
        新闻列表
    """
    try:
        # 使用 Akshare 获取个股新闻
        df = ak.stock_news_stock_em(symbol=symbol)
        
        if df is None or df.empty:
            return []
        
        result = []
        for _, row in df.iterrows():
            # 处理日期格式，统一格式化为 YYYY-MM-dd HH:mm
            datetime_str = format_datetime(str(row.get("datetime", "")))

            result.append({
                "datetime": datetime_str,
                "title": str(row.get("title", "")),
                "content": str(row.get("content", "")),
                "url": str(row.get("url", "")),
                "symbol": symbol
            })
        
        return result
    
    except Exception as e:
        logger.error(f"Failed to get stock news for {symbol}: {e}")
        return []


def get_sentiment_data(date: Optional[str] = None) -> Dict[str, Any]:
    """
    获取市场情绪数据
    
    通过 Akshare 获取涨跌停数据计算情绪指数
    
    Args:
        date: 日期 (YYYYMMDD)，默认为今天
    
    Returns:
        情绪数据
    """
    if not date:
        date = datetime.now().strftime("%Y%m%d")
    
    try:
        # 获取当天涨停股票
        df_limit_up = ak.stock_zt_pool_em(date=date)
        limit_up_count = len(df_limit_up) if df_limit_up is not None else 0
        
        # 获取当天跌停股票
        df_limit_down = ak.stock_zt_pool_dtgc_em(date=date)
        limit_down_count = len(df_limit_down) if df_limit_down is not None else 0
        
        # 计算情绪分数
        sentiment_score = calculate_sentiment_score(limit_up_count, limit_down_count)
        
        # 获取市场整体数据
        try:
            # 获取当日市场表现
            df_market = ak.stock_zh_index_daily(symbol="sh000001")  # 上证指数
            if df_market is not None and not df_market.empty:
                latest = df_market.iloc[-1]
                market_change = float(latest.get("close", 0)) - float(latest.get("open", 0))
                market_change_pct = market_change / float(latest.get("open", 1)) * 100
            else:
                market_change = 0
                market_change_pct = 0
        except:
            market_change = 0
            market_change_pct = 0
        
        return {
            "date": date,
            "limit_up_count": limit_up_count,
            "limit_down_count": limit_down_count,
            "sentiment_score": sentiment_score,
            "market_change": round(market_change, 2),
            "market_change_pct": round(market_change_pct, 2),
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to get sentiment data: {e}")
        return {
            "date": date,
            "limit_up_count": 0,
            "limit_down_count": 0,
            "sentiment_score": 50.0,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


def calculate_sentiment_score(limit_up: int, limit_down: int) -> float:
    """计算情绪分数 (0-100)"""
    total = limit_up + limit_down
    if total == 0:
        return 50.0
    return round((limit_up / total) * 100, 2)


def get_sector_sentiment() -> Dict[str, Any]:
    """
    获取板块情绪数据
    
    Returns:
        板块涨跌情况
    """
    try:
        # 获取板块资金流向
        df_sector = ak.stock_sector_fund_flow_rank(indicator="5日排行")
        
        if df_sector is None or df_empty(df_sector):
            return {}
        
        # 取前 10 个板块
        sectors = []
        for _, row in df_sector.head(10).iterrows():
            sectors.append({
                "name": str(row.get("名称", "")),
                "change": float(row.get("涨跌幅", 0) or 0),
                "fund_flow": float(row.get("主力净流入", 0) or 0)
            })
        
        return {
            "timestamp": datetime.now().isoformat(),
            "sectors": sectors
        }
    
    except Exception as e:
        logger.error(f"Failed to get sector sentiment: {e}")
        return {}


def df_empty(df) -> bool:
    """检查 DataFrame 是否为空"""
    return df is None or df.empty


def save_to_offline_storage(data: Dict[str, Any], data_type: str, date: str) -> bool:
    """
    保存数据到离线存储
    
    Args:
        data: 要保存的数据
        data_type: 数据类型 (news/sentiment/sector_sentiment)
        date: 日期 (YYYYMMDD)
    
    Returns:
        是否保存成功
    """
    try:
        # 本地存储路径
        local_path = os.path.join(settings.LOCAL_STORAGE_PATH, data_type)
        os.makedirs(local_path, exist_ok=True)
        
        filename = f"{date}.json"
        filepath = os.path.join(local_path, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Saved {data_type} data to {filepath}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to save to offline storage: {e}")
        return False


def load_from_offline_storage(data_type: str, date: str) -> Optional[Dict[str, Any]]:
    """
    从离线存储加载数据
    
    Args:
        data_type: 数据类型
        date: 日期 (YYYYMMDD)
    
    Returns:
        数据或 None
    """
    try:
        filepath = os.path.join(settings.LOCAL_STORAGE_PATH, data_type, f"{date}.json")
        
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    
    except Exception as e:
        logger.error(f"Failed to load from offline storage: {e}")
        return None


def get_market_overview() -> Dict[str, Any]:
    """
    获取市场概览数据
    
    Returns:
        市场整体情况
    """
    try:
        # 获取 A 股涨跌分布
        df_change = ak.stock_zt_pool_em(date=datetime.now().strftime("%Y%m%d"))
        
        # 获取成交额
        df_volume = ak.stock_zh_index_daily(symbol="sh000001")
        
        return {
            "timestamp": datetime.now().isoformat(),
            "limit_up": len(df_change) if df_change is not None else 0,
            "volume": float(df_volume.iloc[-1].get("volume", 0)) if df_volume is not None and not df_volume.empty else 0
        }
    except Exception as e:
        logger.error(f"Failed to get market overview: {e}")
        return {}

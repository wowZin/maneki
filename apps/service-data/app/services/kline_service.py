"""
K线数据服务
支持 Tushare Pro 和 Akshare 两个数据源
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
import akshare as ak
from loguru import logger

from app.core import settings
from app.services.data_source import get_tushare_pro, get_data_source


def format_code(code: str, source: str) -> str:
    """根据数据源格式化股票代码"""
    if source == "tushare":
        if code.startswith("6"):
            return f"{code}.SH"
        else:
            return f"{code}.SZ"
    else:
        return code


def format_kline_data(df: pd.DataFrame, source: str) -> List[Dict[str, Any]]:
    """
    统一 K线数据格式
    
    输出格式:
    {
        "date": "2024-01-01",
        "open": 10.0,
        "high": 11.0,
        "low": 9.5,
        "close": 10.5,
        "volume": 1000000
    }
    """
    result = []
    
    if df is None or df.empty:
        return result
    
    for _, row in df.iterrows():
        if source == "tushare":
            item = {
                "date": str(row.get("trade_date", "")),
                "open": float(row.get("open", 0)),
                "high": float(row.get("high", 0)),
                "low": float(row.get("low", 0)),
                "close": float(row.get("close", 0)),
                "volume": int(row.get("vol", 0)) * 100  # Tushare 单位是手
            }
        else:
            # Akshare 格式适配
            date_val = row.get("日期") or row.get("date")
            if isinstance(date_val, pd.Timestamp):
                date_val = date_val.strftime("%Y-%m-%d")
            
            item = {
                "date": str(date_val),
                "open": float(row.get("开盘") or row.get("open", 0)),
                "high": float(row.get("最高") or row.get("high", 0)),
                "low": float(row.get("最低") or row.get("low", 0)),
                "close": float(row.get("收盘") or row.get("close", 0)),
                "volume": int(row.get("成交量") or row.get("volume", 0))
            }
        
        result.append(item)
    
    return result


def get_kline_from_tushare(
    code: str,
    days: int = 30,
    adjust: str = "qfq"
) -> List[Dict[str, Any]]:
    """从 Tushare Pro 获取 K线数据"""
    pro = get_tushare_pro()
    if not pro:
        raise RuntimeError("Tushare Pro not initialized")
    
    ts_code = format_code(code, "tushare")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days + 10)
    
    try:
        df = pro.daily(
            ts_code=ts_code,
            start_date=start_date.strftime("%Y%m%d"),
            end_date=end_date.strftime("%Y%m%d")
        )
        
        if df is None or df.empty:
            return []
        
        df = df.sort_values("trade_date").tail(days)
        
        return format_kline_data(df, "tushare")
    
    except Exception as e:
        logger.error(f"Failed to get K-line from Tushare: {e}")
        raise


def get_kline_from_akshare(
    code: str,
    days: int = 30,
    period: str = "daily"
) -> List[Dict[str, Any]]:
    """从 Akshare 获取 K线数据"""
    try:
        df = ak.stock_zh_a_hist(
            symbol=code,
            period=period,
            start_date=(datetime.now() - timedelta(days=days + 30)).strftime("%Y%m%d"),
            adjust="qfq"
        )
        
        if df is None or df.empty:
            return []
        
        df = df.tail(days)
        
        return format_kline_data(df, "akshare")
    
    except Exception as e:
        logger.error(f"Failed to get K-line from Akshare: {e}")
        raise


def get_kline(
    code: str,
    days: int = 30,
    source: str = "auto"
) -> Dict[str, Any]:
    """
    获取 K线数据（统一入口）
    """
    actual_source = get_data_source(source)
    
    try:
        if actual_source == "tushare":
            data = get_kline_from_tushare(code, days)
        else:
            data = get_kline_from_akshare(code, days)
        
        return {
            "code": 0,
            "data": data,
            "source": actual_source,
            "message": "success"
        }
    
    except Exception as e:
        logger.error(f"Failed to get K-line: {e}")
        return {
            "code": -1,
            "data": [],
            "source": actual_source,
            "message": str(e)
        }


# ===== 批量同步到本地 DB 相关功能 =====

def fetch_kline_for_sync(
    code: str,
    start_date: str,
    end_date: str,
    source: str = "tushare"
) -> List[Dict[str, Any]]:
    """
    获取 K线数据用于批量同步（返回原始格式，便于入库）
    
    Args:
        code: 股票代码
        start_date: 开始日期 (YYYYMMDD)
        end_date: 结束日期 (YYYYMMDD)
        source: 数据源
    
    Returns:
        K线数据列表，包含 code 字段
    """
    try:
        if source == "tushare":
            pro = get_tushare_pro()
            if not pro:
                return []
            
            ts_code = format_code(code, "tushare")
            df = pro.daily(
                ts_code=ts_code,
                start_date=start_date,
                end_date=end_date
            )
            
            if df is None or df.empty:
                return []
            
            # 转换为统一格式并添加 code 字段
            result = []
            for _, row in df.iterrows():
                result.append({
                    "code": code,
                    "date": str(row.get("trade_date", "")),
                    "open": float(row.get("open", 0)),
                    "high": float(row.get("high", 0)),
                    "low": float(row.get("low", 0)),
                    "close": float(row.get("close", 0)),
                    "volume": int(row.get("vol", 0)) * 100,
                    "amount": float(row.get("amount", 0)) * 1000  # Tushare 单位是千元
                })
            return result
        
        else:  # akshare
            df = ak.stock_zh_a_hist(
                symbol=code,
                period="daily",
                start_date=start_date,
                end_date=end_date,
                adjust="qfq"
            )
            
            if df is None or df.empty:
                return []
            
            result = []
            for _, row in df.iterrows():
                date_val = row.get("日期") or row.get("date")
                if isinstance(date_val, pd.Timestamp):
                    date_val = date_val.strftime("%Y%m%d")
                
                result.append({
                    "code": code,
                    "date": str(date_val).replace("-", ""),
                    "open": float(row.get("开盘") or row.get("open", 0)),
                    "high": float(row.get("最高") or row.get("high", 0)),
                    "low": float(row.get("最低") or row.get("low", 0)),
                    "close": float(row.get("收盘") or row.get("close", 0)),
                    "volume": int(row.get("成交量") or row.get("volume", 0)),
                    "amount": float(row.get("成交额") or row.get("amount", 0))
                })
            return result
    
    except Exception as e:
        logger.error(f"Failed to fetch kline for sync: {code}, {e}")
        return []


def get_watch_list() -> List[str]:
    """
    获取需要同步的股票列表
    
    TODO: 从配置或数据库读取关注的股票列表
    当前返回 A 股核心指数成分股作为示例
    """
    # 示例：沪深 300 成分股（实际应从数据库读取）
    return [
        "000001", "000002", "000063", "000100", "000333",
        "000538", "000568", "000651", "000725", "000768",
        "000858", "000895", "002001", "002007", "002024",
        "002027", "002142", "002230", "002236", "002271",
        "002304", "002352", "002415", "002460", "002475",
        "002594", "002714", "300003", "300014", "300015",
        "300033", "300059", "300122", "300124", "300274",
        "300408", "300413", "300433", "300498", "300750",
        "600000", "600009", "600016", "600028", "600030",
        "600031", "600036", "600048", "600050", "600104",
        "600276", "600309", "600406", "600436", "600438",
        "600519", "600547", "600570", "600585", "600588",
        "600660", "600690", "600703", "600745", "600809",
        "600837", "600887", "600900", "601012", "601066",
        "601088", "601100", "601138", "601166", "601211",
        "601288", "601318", "601319", "601398", "601601",
        "601628", "601668", "601688", "601816", "601857",
        "601888", "601899", "601933", "601985", "601988",
        "603288", "603501", "603986", "603993"
    ]

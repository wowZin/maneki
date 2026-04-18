"""
龙虎榜数据服务

从 Tushare 获取龙虎榜数据
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
from loguru import logger

from app.core import settings
from app.services.data_source import get_tushare_pro


def get_top_list(trade_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    获取龙虎榜数据

    Args:
        trade_date: 交易日期 (YYYYMMDD)，默认为最近交易日

    Returns:
        龙虎榜数据列表
    """
    pro = get_tushare_pro()
    if not pro:
        logger.error("Tushare pro not initialized")
        return []

    try:
        # 如果没有指定日期，获取最近交易日
        if not trade_date:
            trade_date = get_latest_trade_date()

        logger.info(f"Fetching top list for {trade_date}...")

        # 调用 Tushare 接口获取龙虎榜数据
        df = pro.top_list(trade_date=trade_date)

        if df is None or df.empty:
            logger.warning(f"No top list data for {trade_date}")
            return []

        logger.info(f"Top list raw columns: {list(df.columns)}, shape: {df.shape}")
        logger.info(f"Top list raw head:\n{df.head()}")

        # 转换为标准格式
        result = []
        for _, row in df.iterrows():
            result.append({
                "ts_code": str(row.get("ts_code", "")),
                "name": str(row.get("name", "")),
                "close": float(row.get("close", 0)) if pd.notna(row.get("close")) else 0,
                "pct_change": float(row.get("pct_change", 0)) if pd.notna(row.get("pct_change")) else 0,
                "turnover": float(row.get("turnover_rate", 0)) if pd.notna(row.get("turnover_rate")) else 0,
                "amount": float(row.get("amount", 0)) if pd.notna(row.get("amount")) else 0,
                "net_buy_amount": float(row.get("l_buy", 0)) if pd.notna(row.get("l_buy")) else 0,
                "net_sell_amount": float(row.get("l_sell", 0)) if pd.notna(row.get("l_sell")) else 0,
                "reason": str(row.get("reason", "")),
                "trade_date": trade_date,
                "source": "tushare",
            })

        logger.info(f"Fetched {len(result)} top list records for {trade_date}")
        return result

    except Exception as e:
        logger.error(f"Failed to get top list: {e}")
        return []


def get_top_list_for_code(ts_code: str, trade_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    获取指定股票的龙虎榜数据

    Args:
        ts_code: 股票代码，如 "002219.SZ"
        trade_date: 交易日期 (YYYYMMDD)，可选

    Returns:
        龙虎榜数据列表
    """
    pro = get_tushare_pro()
    if not pro:
        logger.error("Tushare pro not initialized")
        return []

    try:
        # 调用 Tushare 接口
        params = {"ts_code": ts_code}
        if trade_date:
            params["trade_date"] = trade_date

        logger.info(f"Fetching top list for {ts_code}...")
        df = pro.query('top_list', **params)

        if df is None or df.empty:
            logger.warning(f"No top list data for {ts_code}")
            return []

        # 转换为标准格式
        result = []
        for _, row in df.iterrows():
            result.append({
                "ts_code": str(row.get("ts_code", "")),
                "name": str(row.get("name", "")),
                "close": float(row.get("close", 0)) if pd.notna(row.get("close")) else 0,
                "pct_change": float(row.get("pct_change", 0)) if pd.notna(row.get("pct_change")) else 0,
                "turnover": float(row.get("turnover_rate", 0)) if pd.notna(row.get("turnover_rate")) else 0,
                "amount": float(row.get("amount", 0)) if pd.notna(row.get("amount")) else 0,
                "net_buy_amount": float(row.get("l_buy", 0)) if pd.notna(row.get("l_buy")) else 0,
                "net_sell_amount": float(row.get("l_sell", 0)) if pd.notna(row.get("l_sell")) else 0,
                "reason": str(row.get("reason", "")),
                "trade_date": str(row.get("trade_date", "")),
                "source": "tushare",
            })

        logger.info(f"Fetched {len(result)} top list records for {ts_code}")
        return result

    except Exception as e:
        logger.error(f"Failed to get top list for {ts_code}: {e}")
        return []


def get_latest_trade_date() -> str:
    """获取最近交易日（通过 Tushare 交易日历）"""
    pro = get_tushare_pro()
    if not pro:
        # fallback: 本地简单逻辑
        today = datetime.now()
        if today.hour < 15:
            today = today - timedelta(days=1)
        while today.weekday() >= 5:
            today = today - timedelta(days=1)
        return today.strftime("%Y%m%d")

    try:
        today_str = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y%m%d")
        df = pro.trade_cal(exchange='SSE', start_date=start_date, end_date=today_str, is_open='1')
        if df is None or df.empty:
            logger.warning("trade_cal returned empty, fallback to local logic")
            return today_str
        latest = str(df.iloc[-1]['cal_date'])
        return latest
    except Exception as e:
        logger.error(f"Failed to get latest trade date from Tushare: {e}")
        return datetime.now().strftime("%Y%m%d")


def is_trade_day(date_str: str) -> bool:
    """
    检查是否为交易日（通过 Tushare 交易日历）

    Args:
        date_str: 日期字符串 (YYYYMMDD)

    Returns:
        是否为交易日
    """
    pro = get_tushare_pro()
    if not pro:
        try:
            date = datetime.strptime(date_str, "%Y%m%d")
            return date.weekday() < 5
        except:
            return False

    try:
        df = pro.trade_cal(exchange='SSE', start_date=date_str, end_date=date_str)
        if df is None or df.empty:
            return False
        return str(df.iloc[0]['is_open']) == '1'
    except Exception as e:
        logger.error(f"Failed to check trade day for {date_str}: {e}")
        try:
            date = datetime.strptime(date_str, "%Y%m%d")
            return date.weekday() < 5
        except:
            return False

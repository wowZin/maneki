"""
数据源管理器
统一管理 Tushare Pro 和 Akshare
"""
from typing import Optional, Literal
import tushare as ts
import akshare as ak
from loguru import logger

from app.core import settings


# 全局实例
tushare_pro = None


def init_data_sources():
    """初始化所有数据源"""
    global tushare_pro
    
    # Initialize Tushare Pro
    if settings.TUSHARE_TOKEN:
        try:
            ts.set_token(settings.TUSHARE_TOKEN)
            tushare_pro = ts.pro_api()
            logger.info("Tushare Pro initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Tushare Pro: {e}")
            tushare_pro = None
    else:
        logger.warning("TUSHARE_TOKEN not set, Tushare Pro unavailable")


def get_data_source(source: str) -> Literal["tushare", "akshare"]:
    """
    根据请求参数确定实际使用的数据源
    
    Args:
        source: 请求指定的数据源 (auto/tushare/akshare)
    
    Returns:
        实际使用的数据源名称
    """
    if source == "tushare":
        if tushare_pro:
            return "tushare"
        logger.warning("Tushare Pro requested but not available, fallback to akshare")
        return "akshare"
    
    elif source == "akshare":
        return "akshare"
    
    else:  # auto
        if tushare_pro:
            return "tushare"
        return "akshare"


def get_tushare_pro() -> Optional[object]:
    """获取 Tushare Pro 实例"""
    return tushare_pro

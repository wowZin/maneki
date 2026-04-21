"""
游资名录数据服务

从 Tushare 获取游资名录数据
"""
from typing import List, Dict, Any
from loguru import logger

from app.services.data_source import get_tushare_pro


def get_hot_money_list() -> List[Dict[str, Any]]:
    """
    获取游资名录数据

    Returns:
        游资名录数据列表
    """
    pro = get_tushare_pro()
    if not pro:
        logger.error("Tushare pro not initialized")
        return []

    try:
        logger.info("Fetching hot money list from Tushare...")

        df = pro.hm_list(**{
            "name": "",
            "limit": "",
            "offset": ""
        }, fields=[
            "name",
            "desc",
            "orgs"
        ])

        if df is None or df.empty:
            logger.warning("No hot money data returned from Tushare")
            return []

        logger.info(f"Hot money raw columns: {list(df.columns)}, shape: {df.shape}")
        logger.info(f"Hot money raw head:\n{df.head()}")

        result = []
        for _, row in df.iterrows():
            result.append({
                "name": str(row.get("name", "")).strip(),
                "description": str(row.get("desc", "")).strip(),
                "organizations": str(row.get("orgs", "")).strip(),
                "source": "tushare",
            })

        logger.info(f"Fetched {len(result)} hot money records from Tushare")
        return result

    except Exception as e:
        logger.error(f"Failed to get hot money list: {e}")
        return []

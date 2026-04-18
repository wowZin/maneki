"""
游资名录同步服务

负责将游资名录数据同步到 PostgreSQL
"""
from typing import List, Dict, Any
from loguru import logger

from app.db.database import get_db_session
from app.db.models import HotMoney


def save_hot_money_to_db(data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    将游资名录数据保存到数据库

    Args:
        data_list: 游资名录数据列表

    Returns:
        {"total": 总数, "inserted": 插入数, "updated": 更新数}
    """
    if not data_list:
        return {"total": 0, "inserted": 0, "updated": 0}

    logger.info(f"Saving {len(data_list)} hot money records to DB")
    inserted_count = 0
    updated_count = 0

    with get_db_session() as db:
        for item in data_list:
            try:
                name = item.get("name", "")
                if not name:
                    logger.warning("Hot money item without name, skipping")
                    continue

                existing = db.query(HotMoney).filter(
                    HotMoney.name == name
                ).first()

                if existing:
                    existing.description = item.get("description", "")
                    existing.organizations = item.get("organizations", "")
                    existing.source = item.get("source", "tushare")
                    updated_count += 1
                else:
                    hot_money = HotMoney(
                        name=name,
                        description=item.get("description", ""),
                        organizations=item.get("organizations", ""),
                        source=item.get("source", "tushare"),
                    )
                    db.add(hot_money)
                    inserted_count += 1

            except Exception as e:
                logger.error(f"Failed to save hot money item: {e}")
                continue

        try:
            db.commit()
            logger.info(f"Inserted {inserted_count} hot money records, updated {updated_count}")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit hot money batch: {e}")
            return {"total": len(data_list), "inserted": 0, "updated": 0}

    return {
        "total": len(data_list),
        "inserted": inserted_count,
        "updated": updated_count,
    }


def sync_hot_money_to_db() -> Dict[str, Any]:
    """
    同步游资名录数据到数据库

    Returns:
        {"total": 总数, "inserted": 插入数, "updated": 更新数}
    """
    from app.services.hotmoney_service import get_hot_money_list

    try:
        logger.info("Syncing hot money list to DB")
        data = get_hot_money_list()

        if not data:
            logger.warning("No hot money data returned from Tushare")
            return {
                "total": 0,
                "inserted": 0,
                "updated": 0,
                "message": "No data found",
            }

        logger.info(f"Received {len(data)} hot money records from Tushare")

        result = save_hot_money_to_db(data)

        logger.info(
            f"Hot money DB sync done: total={result['total']}, "
            f"inserted={result['inserted']}, updated={result['updated']}"
        )

        return {
            "total": result["total"],
            "inserted": result["inserted"],
            "updated": result["updated"],
        }

    except Exception as e:
        logger.error(f"Failed to sync hot money: {e}")
        return {
            "total": 0,
            "inserted": 0,
            "updated": 0,
            "error": str(e),
        }


def get_hot_money_stats() -> Dict[str, Any]:
    """
    获取游资名录统计

    Returns:
        {"total": 总数}
    """
    with get_db_session() as db:
        total = db.query(HotMoney).count()

        return {
            "total": total,
        }

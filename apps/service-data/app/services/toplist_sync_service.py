"""
龙虎榜同步服务

负责将龙虎榜数据同步到 PostgreSQL
"""
from datetime import datetime
from typing import List, Dict, Any
from loguru import logger

from app.db.database import get_db_session
from app.db.models import TopList


def save_top_list_to_db(data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    将龙虎榜数据保存到数据库

    Args:
        data_list: 龙虎榜数据列表

    Returns:
        {"total": 总数, "inserted": 插入数, "skipped": 跳过数}
    """
    if not data_list:
        return {"total": 0, "inserted": 0, "skipped": 0}

    logger.info(f"Saving {len(data_list)} top list records to DB")
    inserted_count = 0
    skipped_count = 0

    with get_db_session() as db:
        for item in data_list:
            try:
                trade_date = item.get("trade_date", "")
                ts_code = item.get("ts_code", "")

                if not trade_date or not ts_code:
                    logger.warning("Top list item without trade_date or ts_code, skipping")
                    skipped_count += 1
                    continue

                # 检查是否已存在
                existing = db.query(TopList).filter(
                    TopList.trade_date == trade_date,
                    TopList.ts_code == ts_code
                ).first()

                if existing:
                    # 已存在，更新数据
                    existing.close = item.get("close", 0)
                    existing.pct_change = item.get("pct_change", 0)
                    existing.turnover = item.get("turnover", 0)
                    existing.amount = item.get("amount", 0)
                    existing.net_buy_amount = item.get("net_buy_amount", 0)
                    existing.net_sell_amount = item.get("net_sell_amount", 0)
                    existing.reason = item.get("reason", "")
                    skipped_count += 1
                else:
                    # 创建新记录
                    top_list = TopList(
                        trade_date=trade_date,
                        ts_code=ts_code,
                        name=item.get("name", ""),
                        close=item.get("close", 0),
                        pct_change=item.get("pct_change", 0),
                        turnover=item.get("turnover", 0),
                        amount=item.get("amount", 0),
                        net_buy_amount=item.get("net_buy_amount", 0),
                        net_sell_amount=item.get("net_sell_amount", 0),
                        reason=item.get("reason", ""),
                        source=item.get("source", "tushare"),
                    )
                    db.add(top_list)
                    inserted_count += 1

            except Exception as e:
                logger.error(f"Failed to save top list item: {e}")
                skipped_count += 1
                continue

        # 提交事务
        try:
            db.commit()
            logger.info(f"Inserted {inserted_count} top list records, skipped {skipped_count}")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit top list batch: {e}")
            return {"total": len(data_list), "inserted": 0, "skipped": len(data_list)}

    return {
        "total": len(data_list),
        "inserted": inserted_count,
        "skipped": skipped_count,
    }


def sync_top_list_to_db(trade_date: str = None) -> Dict[str, Any]:
    """
    同步龙虎榜数据到数据库

    Args:
        trade_date: 交易日期 (YYYYMMDD)，默认为最近交易日

    Returns:
        {"trade_date": 日期, "total": 总数, "inserted": 插入数, "skipped": 跳过数}
    """
    from app.services.toplist_service import get_top_list

    try:
        # 获取数据
        logger.info(f"Syncing top list for trade_date={trade_date}")
        data = get_top_list(trade_date)

        if not data:
            logger.warning(f"No top list data returned for trade_date={trade_date}")
            return {
                "trade_date": trade_date,
                "total": 0,
                "inserted": 0,
                "skipped": 0,
                "message": "No data found",
            }

        logger.info(f"Received {len(data)} top list records from Tushare")

        # 保存到数据库
        result = save_top_list_to_db(data)

        logger.info(
            f"Top list DB sync done: total={result['total']}, "
            f"inserted={result['inserted']}, skipped={result['skipped']}"
        )

        return {
            "trade_date": data[0].get("trade_date", trade_date),
            "total": result["total"],
            "inserted": result["inserted"],
            "skipped": result["skipped"],
        }

    except Exception as e:
        logger.error(f"Failed to sync top list: {e}")
        return {
            "trade_date": trade_date,
            "total": 0,
            "inserted": 0,
            "skipped": 0,
            "error": str(e),
        }


def get_top_list_stats(trade_date: str = None) -> Dict[str, Any]:
    """
    获取龙虎榜统计

    Args:
        trade_date: 日期 (YYYYMMDD)，默认为今天

    Returns:
        {"total": 总数, "today_count": 今日数量, "today_amount": 今日成交额}
    """
    if not trade_date:
        trade_date = datetime.now().strftime("%Y%m%d")

    with get_db_session() as db:
        # 总数
        total = db.query(TopList).count()

        # 今日数据
        today_count = db.query(TopList).filter(
            TopList.trade_date == trade_date
        ).count()

        # 今日成交额
        from sqlalchemy import func
        today_amount = db.query(
            func.coalesce(func.sum(TopList.amount), 0)
        ).filter(
            TopList.trade_date == trade_date
        ).scalar()

        return {
            "date": trade_date,
            "total": total,
            "today_count": today_count,
            "today_amount": float(today_amount) if today_amount else 0,
        }

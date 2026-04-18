"""
龙虎榜机构交易名单同步服务

负责将龙虎榜机构交易名单数据同步到 PostgreSQL
"""
from datetime import datetime
from typing import List, Dict, Any
from loguru import logger

from app.db.database import get_db_session
from app.db.models import TopInst


def save_top_inst_to_db(data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    将龙虎榜机构交易名单数据保存到数据库

    Args:
        data_list: 龙虎榜机构交易名单数据列表

    Returns:
        {"total": 总数, "inserted": 插入数, "skipped": 跳过数}
    """
    if not data_list:
        return {"total": 0, "inserted": 0, "skipped": 0}

    # 按 (trade_date, ts_code, exalter) 去重，保留最后一条
    deduped = {}
    for item in data_list:
        key = (item.get("trade_date"), item.get("ts_code"), item.get("exalter", ""))
        deduped[key] = item
    data_list = list(deduped.values())

    logger.info(f"Saving {len(data_list)} top inst records to DB")
    inserted_count = 0
    skipped_count = 0

    with get_db_session() as db:
        for item in data_list:
            try:
                trade_date = item.get("trade_date", "")
                ts_code = item.get("ts_code", "")
                exalter = item.get("exalter", "")

                if not trade_date or not ts_code:
                    logger.warning("Top inst item without trade_date or ts_code, skipping")
                    skipped_count += 1
                    continue

                # 检查是否已存在
                existing = db.query(TopInst).filter(
                    TopInst.trade_date == trade_date,
                    TopInst.ts_code == ts_code,
                    TopInst.exalter == exalter
                ).first()

                if existing:
                    # 已存在，更新数据
                    existing.buy = item.get("buy", 0)
                    existing.buy_rate = item.get("buy_rate", 0)
                    existing.sell = item.get("sell", 0)
                    existing.sell_rate = item.get("sell_rate", 0)
                    existing.net_buy = item.get("net_buy", 0)
                    existing.side = item.get("side", "")
                    existing.reason = item.get("reason", "")
                    skipped_count += 1
                else:
                    # 创建新记录
                    top_inst = TopInst(
                        trade_date=trade_date,
                        ts_code=ts_code,
                        exalter=exalter,
                        buy=item.get("buy", 0),
                        buy_rate=item.get("buy_rate", 0),
                        sell=item.get("sell", 0),
                        sell_rate=item.get("sell_rate", 0),
                        net_buy=item.get("net_buy", 0),
                        side=item.get("side", ""),
                        reason=item.get("reason", ""),
                        source=item.get("source", "tushare"),
                    )
                    db.add(top_inst)
                    inserted_count += 1

            except Exception as e:
                logger.error(f"Failed to save top inst item: {e}")
                skipped_count += 1
                continue

        # 提交事务
        try:
            db.commit()
            logger.info(f"Inserted {inserted_count} top inst records, skipped {skipped_count}")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit top inst batch: {e}")
            return {"total": len(data_list), "inserted": 0, "skipped": len(data_list)}

    return {
        "total": len(data_list),
        "inserted": inserted_count,
        "skipped": skipped_count,
    }


def sync_top_inst_to_db(trade_date: str = None) -> Dict[str, Any]:
    """
    同步龙虎榜机构交易名单数据到数据库

    Args:
        trade_date: 交易日期 (YYYYMMDD)，默认为最近交易日

    Returns:
        {"trade_date": 日期, "total": 总数, "inserted": 插入数, "skipped": 跳过数}
    """
    from app.services.topinst_service import get_top_inst

    try:
        # 获取数据
        logger.info(f"Syncing top inst for trade_date={trade_date}")
        data = get_top_inst(trade_date)

        if not data:
            logger.warning(f"No top inst data returned for trade_date={trade_date}")
            return {
                "trade_date": trade_date,
                "total": 0,
                "inserted": 0,
                "skipped": 0,
                "message": "No data found",
            }

        logger.info(f"Received {len(data)} top inst records from Tushare")

        # 保存到数据库
        result = save_top_inst_to_db(data)

        logger.info(
            f"Top inst DB sync done: total={result['total']}, "
            f"inserted={result['inserted']}, skipped={result['skipped']}"
        )

        return {
            "trade_date": data[0].get("trade_date", trade_date),
            "total": result["total"],
            "inserted": result["inserted"],
            "skipped": result["skipped"],
        }

    except Exception as e:
        logger.error(f"Failed to sync top inst: {e}")
        return {
            "trade_date": trade_date,
            "total": 0,
            "inserted": 0,
            "skipped": 0,
            "error": str(e),
        }


def get_top_inst_stats(trade_date: str = None) -> Dict[str, Any]:
    """
    获取龙虎榜机构交易名单统计

    Args:
        trade_date: 日期 (YYYYMMDD)，默认为今天

    Returns:
        {"total": 总数, "today_count": 今日数量, "today_net_buy": 今日净买入额}
    """
    if not trade_date:
        trade_date = datetime.now().strftime("%Y%m%d")

    with get_db_session() as db:
        # 总数
        total = db.query(TopInst).count()

        # 今日数据
        today_count = db.query(TopInst).filter(
            TopInst.trade_date == trade_date
        ).count()

        # 今日净买入额
        from sqlalchemy import func
        today_net_buy = db.query(
            func.coalesce(func.sum(TopInst.net_buy), 0)
        ).filter(
            TopInst.trade_date == trade_date
        ).scalar()

        return {
            "date": trade_date,
            "total": total,
            "today_count": today_count,
            "today_net_buy": float(today_net_buy) if today_net_buy else 0,
        }

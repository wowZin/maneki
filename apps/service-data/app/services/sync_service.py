"""
数据同步服务
负责从数据源批量同步数据到本地 DB
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import func\nfrom sqlalchemy.dialects.postgresql import insert
from loguru import logger

from app.db.database import get_db_session
from app.db.models import KLine, StockBasic
from app.services.kline_service import fetch_kline_for_sync, get_watch_list
from app.services.data_source import get_tushare_pro


def batch_upsert_kline(data_list: List[Dict[str, Any]]) -> int:
    """
    批量 upsert K线数据
    
    Args:
        data_list: K线数据列表
    
    Returns:
        插入/更新的记录数
    """
    if not data_list:
        return 0
    
    with get_db_session() as db:
        # 使用 PostgreSQL 的 ON CONFLICT DO UPDATE
        stmt = insert(KLine).values(data_list)
        
        # 冲突时更新字段
        update_dict = {
            "open": stmt.excluded.open,
            "high": stmt.excluded.high,
            "low": stmt.excluded.low,
            "close": stmt.excluded.close,
            "volume": stmt.excluded.volume,
            "amount": stmt.excluded.amount,
            "updated_at": func.now()
        }
        
        stmt = stmt.on_conflict_do_update(
            index_elements=['code', 'date'],
            set_=update_dict
        )
        
        result = db.execute(stmt)
        return result.rowcount


def sync_kline_for_code(
    code: str,
    days: int = 30,
    source: str = "tushare"
) -> Dict[str, Any]:
    """
    同步单只股票的 K线数据
    
    Args:
        code: 股票代码
        days: 同步天数
        source: 数据源
    
    Returns:
        {"code": 股票代码, "count": 记录数, "success": 是否成功}
    """
    try:
        # 计算日期范围
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 拉取数据
        data = fetch_kline_for_sync(
            code=code,
            start_date=start_date.strftime("%Y%m%d"),
            end_date=end_date.strftime("%Y%m%d"),
            source=source
        )
        
        if not data:
            return {"code": code, "count": 0, "success": True}
        
        # 批量写入
        count = batch_upsert_kline(data)
        
        return {
            "code": code,
            "count": count,
            "success": True
        }
    
    except Exception as e:
        logger.error(f"Failed to sync kline for {code}: {e}")
        return {
            "code": code,
            "count": 0,
            "success": False,
            "error": str(e)
        }


def sync_all_kline(
    codes: Optional[List[str]] = None,
    days: int = 30,
    source: str = "tushare"
) -> Dict[str, Any]:
    """
    批量同步所有关注股票的 K线数据
    
    Args:
        codes: 股票代码列表，默认使用 get_watch_list()
        days: 同步天数
        source: 数据源
    
    Returns:
        {"total": 总数, "success": 成功数, "failed": 失败数, "details": []}
    """
    if codes is None:
        codes = get_watch_list()
    
    logger.info(f"Starting batch sync for {len(codes)} stocks, days={days}")
    
    total = len(codes)
    success_count = 0
    failed_count = 0
    details = []
    
    for i, code in enumerate(codes, 1):
        result = sync_kline_for_code(code, days, source)
        details.append(result)
        
        if result["success"]:
            success_count += 1
        else:
            failed_count += 1
        
        # 每 10 个记录一次进度
        if i % 10 == 0:
            logger.info(f"Sync progress: {i}/{total}, success={success_count}, failed={failed_count}")
    
    logger.info(f"Batch sync completed: total={total}, success={success_count}, failed={failed_count}")
    
    return {
        "total": total,
        "success": success_count,
        "failed": failed_count,
        "details": details
    }


def get_kline_from_db(
    code: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    从本地数据库查询 K线数据
    
    Args:
        code: 股票代码
        start_date: 开始日期 (YYYYMMDD)
        end_date: 结束日期 (YYYYMMDD)
        days: 如果未指定日期范围，则取最近 days 天
    
    Returns:
        K线数据列表
    """
    with get_db_session() as db:
        query = db.query(KLine).filter(KLine.code == code)
        
        if start_date:
            query = query.filter(KLine.date >= start_date)
        if end_date:
            query = query.filter(KLine.date <= end_date)
        
        # 如果没有指定日期范围，取最近 N 天
        if not start_date and not end_date:
            # 这里简化处理，实际应该用子查询
            query = query.order_by(KLine.date.desc()).limit(days)
        else:
            query = query.order_by(KLine.date.desc())
        
        records = query.all()
        
        # 转换并反转顺序（从旧到新）
        result = [r.to_dict() for r in records]
        result.reverse()
        
        return result


def sync_stock_basic() -> Dict[str, Any]:
    """
    同步股票基础信息（从 Tushare）
    
    Returns:
        {"count": 记录数, "success": 是否成功}
    """
    pro = get_tushare_pro()
    if not pro:
        logger.error("Tushare Pro not initialized")
        return {"count": 0, "success": False}
    
    try:
        # 获取股票列表
        df = pro.stock_basic(
            exchange='',
            list_status='L',  # 上市
            fields='ts_code,symbol,name,exchange,industry,list_date'
        )
        
        if df is None or df.empty:
            return {"count": 0, "success": True}
        
        # 准备数据
        data_list = []
        for _, row in df.iterrows():
            data_list.append({
                "code": row.get("symbol"),
                "name": row.get("name"),
                "exchange": row.get("exchange"),
                "industry": row.get("industry"),
                "list_date": str(row.get("list_date")) if row.get("list_date") else None
            })
        
        # 批量 upsert
        with get_db_session() as db:
            stmt = insert(StockBasic).values(data_list)
            
            update_dict = {
                "name": stmt.excluded.name,
                "industry": stmt.excluded.industry,
                "updated_at": func.now()
            }
            
            stmt = stmt.on_conflict_do_update(
                index_elements=['code'],
                set_=update_dict
            )
            
            result = db.execute(stmt)
            
            return {
                "count": result.rowcount,
                "success": True
            }
    
    except Exception as e:
        logger.error(f"Failed to sync stock basic: {e}")
        return {"count": 0, "success": False, "error": str(e)}

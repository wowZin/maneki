"""
新闻同步服务
负责将新闻数据同步到 PostgreSQL

支持多数据源：
- 同一来源内按标题去重（无标题按内容前20字符）
- 不同来源的新闻可以重复保留
"""
from datetime import datetime
from typing import List, Dict, Any, Set
from loguru import logger

from app.db.database import get_db_session
from app.db.models import News


def get_dedup_key(title: str, content: str = "") -> str:
    """
    获取去重键
    
    策略：
    1. 有标题的按标题去重
    2. 无标题的按内容前20字符去重
    """
    title = title.strip() if title else ""
    if title:
        return title
    
    # 无标题，使用内容前20字符
    content = content.strip() if content else ""
    return content[:20] if content else ""


def save_news_to_db(news_list: List[Dict[str, Any]], news_date: str = None, source: str = None) -> int:
    """
    将新闻列表保存到数据库（支持同一来源内去重）
    
    Args:
        news_list: 新闻列表，每项应包含 source 字段
        news_date: 新闻日期 (YYYYMMDD)
        source: 指定来源（如果 news_list 中没有 source 字段）
    
    Returns:
        实际插入的记录数
    """
    if not news_list:
        return 0
    
    if not news_date:
        news_date = datetime.now().strftime("%Y%m%d")
    
    inserted_count = 0
    
    with get_db_session() as db:
        for item in news_list:
            try:
                item_source = item.get("source", source)
                if not item_source:
                    logger.warning("News item without source, skipping")
                    continue
                
                title = item.get("title", "")
                content = item.get("content", "")
                
                # 获取去重键
                dedup_key = get_dedup_key(title, content)
                if not dedup_key:
                    logger.warning("Empty dedup key, skipping")
                    continue
                
                # 检查是否已存在（同一来源 + 同一标题/内容）
                existing = db.query(News).filter(
                    News.source == item_source,
                    News.news_date == news_date
                ).filter(
                    (News.title == dedup_key) | 
                    (News.title.is_(None) & News.content.like(f"{dedup_key}%"))
                ).first()
                
                if existing:
                    # 已存在，跳过
                    continue
                
                # 创建新记录
                news = News(
                    title=title if title else None,
                    content=content,
                    source=item_source,
                    source_url=item.get("url", item.get("source_url", "")),
                    news_date=news_date
                )
                
                db.add(news)
                inserted_count += 1
            
            except Exception as e:
                logger.error(f"Failed to save news item: {e}")
                continue
        
        # 提交事务
        try:
            db.commit()
            logger.info(f"Inserted {inserted_count} news records to DB")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit news batch: {e}")
            return 0
    
    return inserted_count


def sync_news_to_db(news_date: str = None, source: str = None) -> Dict[str, Any]:
    """
    同步当天新闻到数据库
    
    Args:
        news_date: 日期 (YYYYMMDD)，默认为今天
        source: 指定来源（用于单来源同步）
    
    Returns:
        {"total": 总数, "inserted": 插入数, "skipped": 跳过数}
    """
    if not news_date:
        news_date = datetime.now().strftime("%Y%m%d")
    
    # 如果没有指定来源，使用多数据源管理器
    if not source:
        from app.services.news_sources import NewsSourceManager
        
        manager = NewsSourceManager()
        source_results = manager.fetch_all_news()
        all_news = manager.merge_news(source_results)
        
        inserted = 0
        for item in all_news:
            result = save_news_to_db([item], news_date, item.get("source"))
            inserted += result
        
        total = len(all_news)
        return {
            "date": news_date,
            "total": total,
            "inserted": inserted,
            "skipped": total - inserted,
            "by_source": manager.get_source_stats(source_results)
        }
    else:
        # 单一来源同步（保持向后兼容）
        from app.services.news_service import get_major_news
        
        news_list = get_major_news(
            start_date=news_date,
            end_date=news_date
        )
        
        total = len(news_list)
        inserted = save_news_to_db(news_list, news_date, source)
        
        return {
            "date": news_date,
            "total": total,
            "inserted": inserted,
            "skipped": total - inserted
        }


def get_news_stats(news_date: str = None) -> Dict[str, Any]:
    """
    获取新闻统计
    
    Args:
        news_date: 日期 (YYYYMMDD)，默认为今天
    
    Returns:
        {"total": 总数, "by_source": 各来源统计}
    """
    if not news_date:
        news_date = datetime.now().strftime("%Y%m%d")
    
    with get_db_session() as db:
        # 总数
        total = db.query(News).filter(News.news_date == news_date).count()
        
        # 按来源统计
        from sqlalchemy import func
        source_stats = db.query(
            News.source,
            func.count(News.id).label("count")
        ).filter(
            News.news_date == news_date
        ).group_by(News.source).all()
        
        by_source = {s.source: s.count for s in source_stats}
        
        return {
            "date": news_date,
            "total": total,
            "by_source": by_source
        }

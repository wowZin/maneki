"""
新闻数据源管理器

负责：
1. 管理多个数据源
2. 协调抓取任务
3. 同源去重（标题 or 内容前20字符）
4. 不同源保留重复
"""
from typing import List, Dict, Any, Set
from collections import defaultdict
from loguru import logger
from datetime import datetime

from .base import BaseNewsSource
from .futu import FutuNewsSource
from .ths import ThsNewsSource
from .cls import ClsNewsSource
from .sina import SinaNewsSource


class NewsSourceManager:
    """新闻数据源管理器"""
    
    # 支持的数据源
    SOURCES = {
        "global_futu": FutuNewsSource,
        "global_ths": ThsNewsSource,
        "global_cls": ClsNewsSource,
        "global_sina": SinaNewsSource,
    }
    
    def __init__(self):
        self.sources: Dict[str, BaseNewsSource] = {}
        self._init_sources()
    
    def _init_sources(self):
        """初始化所有数据源（允许个别失败）"""
        for source_id, source_class in self.SOURCES.items():
            try:
                self.sources[source_id] = source_class()
                logger.info(f"Initialized news source: {source_id}")
            except Exception as e:
                logger.warning(f"Failed to initialize news source {source_id}: {e}")
                # 初始化失败不抛出，继续初始化其他源
    
    def fetch_all_news(self, enabled_sources: List[str] = None, **kwargs) -> Dict[str, List[Dict[str, Any]]]:
        """
        从数据源抓取新闻

        Args:
            enabled_sources: 启用的数据源列表，None表示抓取所有

        Returns:
            {source_id: [news_item, ...]}
        """
        results = {}

        # 确定要抓取的数据源
        sources_to_fetch = enabled_sources if enabled_sources else list(self.sources.keys())

        for source_id in sources_to_fetch:
            source = self.sources.get(source_id)
            if not source:
                logger.warning(f"Source {source_id} not initialized, skipping")
                results[source_id] = []
                continue

            try:
                logger.info(f"Fetching news from {source_id}...")
                raw_news = source.fetch_news(**kwargs)

                # 标准化格式
                normalized = source.normalize_news(raw_news)

                # 同源去重
                deduped = self._dedup_by_source(normalized, source_id)

                results[source_id] = deduped
                logger.info(f"Fetched {len(deduped)} news from {source_id} (after dedup)")

            except Exception as e:
                logger.warning(f"Failed to fetch news from {source_id}: {e}")
                results[source_id] = []

        return results
    
    def _dedup_by_source(self, news_list: List[Dict[str, Any]], source_id: str) -> List[Dict[str, Any]]:
        """
        同源去重
        
        策略：
        1. 有标题的按标题去重
        2. 无标题的按内容前20字符去重
        
        Args:
            news_list: 新闻列表
            source_id: 数据源ID
        
        Returns:
            去重后的新闻列表
        """
        seen_keys: Set[str] = set()
        deduped = []
        
        source = self.sources.get(source_id)
        if not source:
            return news_list
        
        for item in news_list:
            dedup_key = source.get_dedup_key(item)
            
            if not dedup_key:
                # 无法生成去重键，保留
                deduped.append(item)
                continue
            
            # 添加来源前缀，确保不同来源的新闻不互相去重
            full_key = f"{source_id}:{dedup_key}"
            
            if full_key not in seen_keys:
                seen_keys.add(full_key)
                deduped.append(item)
        
        return deduped
    
    def merge_news(self, source_results: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        合并所有来源的新闻
        
        不同来源的新闻保留重复（即同一新闻从不同来源获取都保留）
        
        Args:
            source_results: {source_id: [news_item, ...]}
        
        Returns:
            合并后的新闻列表
        """
        all_news = []
        
        for source_id, news_list in source_results.items():
            for item in news_list:
                # 添加元信息
                item["_fetch_time"] = datetime.now().isoformat()
                all_news.append(item)
        
        # 按发布时间排序（如果有）
        all_news.sort(
            key=lambda x: x.get("publish_time", ""),
            reverse=True
        )
        
        return all_news
    
    def get_source_stats(self, source_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        获取各数据源的统计信息
        
        Returns:
            {
                "total": 总数,
                "by_source": {
                    "global_futu": 100,
                    "global_ths": 80,
                    ...
                }
            }
        """
        total = 0
        by_source = {}
        
        for source_id, news_list in source_results.items():
            count = len(news_list)
            by_source[source_id] = count
            total += count
        
        return {
            "total": total,
            "by_source": by_source,
        }
    
    def sync_to_database(self, news_list: List[Dict[str, Any]], news_date: str = None) -> Dict[str, Any]:
        """
        将新闻同步到数据库
        
        Args:
            news_list: 新闻列表
            news_date: 日期 (YYYYMMDD)
        
        Returns:
            {"total": 总数, "inserted": 插入数, "skipped": 跳过数}
        """
        if not news_date:
            news_date = datetime.now().strftime("%Y%m%d")
        
        from app.services.news_sync_service import save_news_to_db
        
        # 转换为数据库存储格式
        db_records = []
        for item in news_list:
            db_records.append({
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "source": item.get("source", ""),
                "url": item.get("url", ""),
                "publish_time": item.get("publish_time", ""),
            })
        
        # 保存到数据库
        inserted = save_news_to_db(db_records, news_date)
        
        return {
            "date": news_date,
            "total": len(news_list),
            "inserted": inserted,
            "skipped": len(news_list) - inserted,
        }

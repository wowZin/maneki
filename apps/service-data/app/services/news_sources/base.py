"""
新闻数据源基类
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any


class BaseNewsSource(ABC):
    """新闻数据源基类"""
    
    def __init__(self, source_id: str, source_name: str):
        self.source_id = source_id
        self.source_name = source_name
    
    @abstractmethod
    def fetch_news(self, **kwargs) -> List[Dict[str, Any]]:
        """
        获取新闻列表
        
        Returns:
            新闻列表，每项包含：
            - title: 标题
            - content: 内容
            - url: 链接
            - publish_time: 发布时间
        """
        pass
    
    def normalize_news(self, raw_news: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        标准化新闻数据格式
        
        Args:
            raw_news: 原始新闻数据
        
        Returns:
            标准化后的新闻列表
        """
        normalized = []
        for item in raw_news:
            normalized.append({
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "url": item.get("url", ""),
                "publish_time": item.get("publish_time", ""),
                "source": self.source_id,
                "source_name": self.source_name,
            })
        return normalized
    
    def get_dedup_key(self, news_item: Dict[str, Any]) -> str:
        """
        获取去重键
        
        策略：
        1. 有标题的按标题去重
        2. 无标题的按内容前20字符去重
        
        Args:
            news_item: 新闻项
        
        Returns:
            去重键
        """
        title = news_item.get("title", "").strip()
        if title:
            return title
        
        # 无标题，使用内容前20字符
        content = news_item.get("content", "").strip()
        return content[:20] if content else ""

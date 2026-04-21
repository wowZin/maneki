"""
新闻数据源基类
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any
import re
from datetime import datetime


def format_datetime(dt_str: str) -> str:
    """
    将各种日期时间格式统一格式化为 YYYY-MM-dd HH:mm
    """
    if not dt_str or dt_str == 'nan':
        return ''

    dt_str = str(dt_str).strip()

    # 尝试解析各种格式
    patterns = [
        (r'^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$', '%Y-%m-%d %H:%M:%S'),
        (r'^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$', '%Y-%m-%d %H:%M'),
        (r'^(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$', '%Y/%m/%d %H:%M:%S'),
        (r'^(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2})$', '%Y/%m/%d %H:%M'),
        (r'^(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2}):(\d{2})$', '%Y年%m月%d日 %H:%M:%S'),
        (r'^(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})$', '%Y年%m月%d日 %H:%M'),
        (r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})', '%Y-%m-%dT%H:%M:%S'),
    ]

    for pattern, fmt in patterns:
        if re.match(pattern, dt_str):
            try:
                dt = datetime.strptime(dt_str[:len(fmt.replace('%', ''))], fmt)
                return dt.strftime('%Y-%m-%d %H:%M')
            except ValueError:
                continue

    # 如果都不匹配，尝试用 pandas
    try:
        import pandas as pd
        dt = pd.to_datetime(dt_str)
        return dt.strftime('%Y-%m-%d %H:%M')
    except:
        pass

    return dt_str


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
            # 格式化发布时间
            publish_time = format_datetime(item.get("publish_time", ""))

            normalized.append({
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "url": item.get("url", ""),
                "publish_time": publish_time,
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

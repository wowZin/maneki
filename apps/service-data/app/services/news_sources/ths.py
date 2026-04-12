"""
同花顺新闻数据源
"""
from typing import List, Dict, Any
from loguru import logger
import akshare as ak

from .base import BaseNewsSource


class ThsNewsSource(BaseNewsSource):
    """同花顺新闻数据源"""
    
    def __init__(self):
        super().__init__("global_ths", "同花顺")
    
    def fetch_news(self, **kwargs) -> List[Dict[str, Any]]:
        """
        获取同花顺新闻快讯
        
        Returns:
            新闻列表
        """
        logger.info("Fetching news from THS...")
        
        try:
            # 使用 akshare 获取同花顺全球新闻
            df = ak.stock_info_global_ths()
            
            if df is None or df.empty:
                logger.warning("No news returned from THS")
                return []
            
            # 转换为标准格式
            news_list = []
            for _, row in df.iterrows():
                title = str(row.get("标题", "")).strip()
                content = str(row.get("内容", "")).strip()
                publish_time = str(row.get("发布时间", "")).strip()
                url = str(row.get("链接", "")).strip()
                
                news_list.append({
                    "title": title,
                    "content": content,
                    "url": url,
                    "publish_time": publish_time,
                })
            
            logger.info(f"Fetched {len(news_list)} news from THS")
            return news_list
            
        except Exception as e:
            logger.error(f"Failed to fetch news from THS: {e}")
            return []

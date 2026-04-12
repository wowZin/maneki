"""
新浪财经新闻数据源
"""
from typing import List, Dict, Any
from loguru import logger
import akshare as ak

from .base import BaseNewsSource


class SinaNewsSource(BaseNewsSource):
    """新浪财经新闻数据源"""
    
    def __init__(self):
        super().__init__("global_sina", "新浪财经")
    
    def fetch_news(self, **kwargs) -> List[Dict[str, Any]]:
        """
        获取新浪财经全球新闻快讯
        
        Returns:
            新闻列表
        """
        logger.info("Fetching news from Sina...")
        
        try:
            # 使用 akshare 获取新浪财经全球新闻
            df = ak.stock_info_global_sina()
            
            if df is None or df.empty:
                logger.warning("No news returned from Sina")
                return []
            
            # 转换为标准格式
            news_list = []
            for _, row in df.iterrows():
                # 新浪财经只有时间和内容
                publish_time = str(row.get("时间", "")).strip()
                content = str(row.get("内容", "")).strip()
                
                # 新浪没有标题，使用内容前20字作为标题
                title = content[:20] + "..." if len(content) > 20 else content
                
                news_list.append({
                    "title": title,
                    "content": content,
                    "url": "",  # 新浪全球新闻没有单独的链接
                    "publish_time": publish_time,
                })
            
            logger.info(f"Fetched {len(news_list)} news from Sina")
            return news_list
            
        except Exception as e:
            logger.error(f"Failed to fetch news from Sina: {e}")
            return []

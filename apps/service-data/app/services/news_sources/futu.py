"""
富途牛牛新闻数据源
"""
from typing import List, Dict, Any
from loguru import logger
import akshare as ak

from .base import BaseNewsSource


class FutuNewsSource(BaseNewsSource):
    """富途牛牛新闻数据源"""
    
    def __init__(self):
        super().__init__("global_futu", "富途牛牛")
    
    def fetch_news(self, **kwargs) -> List[Dict[str, Any]]:
        """
        获取富途牛牛新闻快讯
        
        Returns:
            新闻列表
        """
        logger.info("Fetching news from Futu...")
        
        try:
            # 使用 akshare 获取富途牛牛全球新闻
            df = ak.stock_info_global_futu()
            
            if df is None or df.empty:
                logger.warning("No news returned from Futu")
                return []
            
            # 转换为标准格式
            news_list = []
            for _, row in df.iterrows():
                title = str(row.get("标题", "")).strip()
                content = str(row.get("内容", "")).strip()
                publish_time = str(row.get("发布时间", "")).strip()
                url = str(row.get("链接", "")).strip()
                
                # 富途的标题可能为空，使用内容前20字作为标题
                if not title and content:
                    title = content[:20] + "..." if len(content) > 20 else content
                
                news_list.append({
                    "title": title,
                    "content": content,
                    "url": url,
                    "publish_time": publish_time,
                })
            
            logger.info(f"Fetched {len(news_list)} news from Futu")
            return news_list
            
        except Exception as e:
            logger.error(f"Failed to fetch news from Futu: {e}")
            return []

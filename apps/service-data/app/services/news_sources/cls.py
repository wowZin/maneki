"""
财联社新闻数据源
"""
from typing import List, Dict, Any
from datetime import datetime
from loguru import logger
import akshare as ak

from .base import BaseNewsSource


class ClsNewsSource(BaseNewsSource):
    """财联社新闻数据源"""
    
    def __init__(self):
        super().__init__("global_cls", "财联社")
    
    def fetch_news(self, **kwargs) -> List[Dict[str, Any]]:
        """
        获取财联社电报
        
        Returns:
            新闻列表
        """
        logger.info("Fetching news from CLS...")
        
        try:
            # 使用 akshare 获取财联社电报
            df = ak.stock_info_global_cls(symbol="全部")
            
            if df is None or df.empty:
                logger.warning("No news returned from CLS")
                return []
            
            # 转换为标准格式
            news_list = []
            for _, row in df.iterrows():
                title = str(row.get("标题", "")).strip()
                content = str(row.get("内容", "")).strip()
                
                # 处理发布时间（财联社的时间是分开的）
                # 发布日期是时间戳，需要转换
                publish_date_ts = row.get("发布日期")
                publish_time = str(row.get("发布时间", "")).strip()
                
                # 将时间戳转换为日期
                if publish_date_ts:
                    try:
                        # 毫秒时间戳转秒
                        if isinstance(publish_date_ts, (int, float)):
                            date_obj = datetime.fromtimestamp(publish_date_ts / 1000)
                            date_str = date_obj.strftime("%Y-%m-%d")
                            publish_datetime = f"{date_str} {publish_time}" if publish_time else date_str
                        else:
                            publish_datetime = publish_time
                    except:
                        publish_datetime = publish_time
                else:
                    publish_datetime = publish_time
                
                news_list.append({
                    "title": title,
                    "content": content,
                    "url": "",  # 财联社电报没有单独的链接
                    "publish_time": publish_datetime,
                })
            
            logger.info(f"Fetched {len(news_list)} news from CLS")
            return news_list
            
        except Exception as e:
            logger.error(f"Failed to fetch news from CLS: {e}")
            return []

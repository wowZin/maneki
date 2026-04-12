"""
新闻数据源集合

支持的数据源：
- global_futu: 富途牛牛
- global_ths: 同花顺
- global_cls: 财联社
- global_sina: 新浪财经
"""
from .manager import NewsSourceManager
from .base import BaseNewsSource

__all__ = ["NewsSourceManager", "BaseNewsSource"]

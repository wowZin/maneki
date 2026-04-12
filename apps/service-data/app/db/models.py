"""
数据库模型

K线数据使用 TimescaleDB 的 hypertable 特性
"""
from sqlalchemy import Column, String, Float, Integer, DateTime, Index, Text
from sqlalchemy.sql import func
from app.db.database import Base


class KLine(Base):
    """K线数据表"""
    __tablename__ = "kline"

    # 复合主键: code + date
    code = Column(String(10), primary_key=True, index=True, comment="股票代码")
    date = Column(String(8), primary_key=True, index=True, comment="日期 YYYYMMDD")

    open = Column(Float, nullable=False, comment="开盘价")
    high = Column(Float, nullable=False, comment="最高价")
    low = Column(Float, nullable=False, comment="最低价")
    close = Column(Float, nullable=False, comment="收盘价")
    volume = Column(Integer, nullable=False, comment="成交量")
    amount = Column(Float, nullable=True, comment="成交额")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    __table_args__ = (
        Index('idx_kline_code_date', 'code', 'date'),
    )

    def to_dict(self):
        return {
            "code": self.code,
            "date": self.date,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "amount": self.amount
        }


class StockBasic(Base):
    """股票基础信息表"""
    __tablename__ = "stock_basic"

    code = Column(String(10), primary_key=True, comment="股票代码")
    name = Column(String(100), nullable=True, comment="股票名称")
    exchange = Column(String(10), nullable=True, comment="交易所")
    industry = Column(String(50), nullable=True, comment="行业")
    list_date = Column(String(8), nullable=True, comment="上市日期")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        return {
            "code": self.code,
            "name": self.name,
            "exchange": self.exchange,
            "industry": self.industry,
            "list_date": self.list_date
        }


class News(Base):
    """新闻资讯表"""
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="ID")
    title = Column(String(500), nullable=True, index=True, comment="新闻标题")
    content = Column(Text, nullable=True, comment="新闻内容")
    source = Column(String(50), nullable=False, index=True, comment="信息来源")
    source_url = Column(String(1000), nullable=True, comment="原文链接")
    news_date = Column(String(8), nullable=False, index=True, comment="新闻日期 YYYYMMDD")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    __table_args__ = (
        Index('idx_news_date', 'news_date'),
        Index('idx_news_source', 'source'),
        # 多数据源去重：同一来源按标题+日期去重，不同来源可以重复
        Index('idx_news_source_title_date', 'source', 'title', 'news_date'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "source": self.source,
            "source_url": self.source_url,
            "news_date": self.news_date,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

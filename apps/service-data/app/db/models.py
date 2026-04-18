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
    publish_time = Column(String(16), nullable=True, comment="发布时间 HH:MM")

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
            "publish_time": self.publish_time,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class TopList(Base):
    """龙虎榜数据表"""
    __tablename__ = "top_list"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="ID")
    trade_date = Column(String(8), nullable=False, index=True, comment="交易日期 YYYYMMDD")
    ts_code = Column(String(20), nullable=False, index=True, comment="股票代码")
    name = Column(String(100), nullable=True, comment="股票名称")
    close = Column(Float, nullable=True, comment="收盘价")
    pct_change = Column(Float, nullable=True, comment="涨跌幅")
    turnover = Column(Float, nullable=True, comment="换手率")
    amount = Column(Float, nullable=True, comment="龙虎榜成交额")
    net_buy_amount = Column(Float, nullable=True, comment="龙虎榜净买入额")
    net_sell_amount = Column(Float, nullable=True, comment="龙虎榜净卖出额")
    reason = Column(Text, nullable=True, comment="上榜原因")
    source = Column(String(50), nullable=False, index=True, comment="数据来源")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    __table_args__ = (
        Index('idx_top_list_date', 'trade_date'),
        Index('idx_top_list_code', 'ts_code'),
        # 按交易日期+股票代码唯一
        Index('idx_top_list_date_code', 'trade_date', 'ts_code', unique=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "trade_date": self.trade_date,
            "ts_code": self.ts_code,
            "name": self.name,
            "close": self.close,
            "pct_change": self.pct_change,
            "turnover": self.turnover,
            "amount": self.amount,
            "net_buy_amount": self.net_buy_amount,
            "net_sell_amount": self.net_sell_amount,
            "reason": self.reason,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class HotMoney(Base):
    """游资名录表"""
    __tablename__ = "hot_money"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="ID")
    name = Column(String(100), nullable=False, unique=True, index=True, comment="游资名称")
    description = Column(Text, nullable=True, comment="游资描述")
    organizations = Column(Text, nullable=True, comment="关联机构 JSON")
    source = Column(String(50), nullable=False, index=True, comment="数据来源")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    __table_args__ = (
        Index('idx_hot_money_name', 'name', unique=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "organizations": self.organizations,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class TopInst(Base):
    """龙虎榜机构交易名单表"""
    __tablename__ = "top_inst"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="ID")
    trade_date = Column(String(8), nullable=False, index=True, comment="交易日期 YYYYMMDD")
    ts_code = Column(String(20), nullable=False, index=True, comment="股票代码")
    exalter = Column(String(200), nullable=True, comment="营业部名称")
    buy = Column(Float, nullable=True, comment="买入额(万)")
    buy_rate = Column(Float, nullable=True, comment="买入占总成交比例")
    sell = Column(Float, nullable=True, comment="卖出额(万)")
    sell_rate = Column(Float, nullable=True, comment="卖出占总成交比例")
    net_buy = Column(Float, nullable=True, comment="净买额(万)")
    side = Column(String(20), nullable=True, comment="买卖方向")
    reason = Column(Text, nullable=True, comment="上榜原因")
    source = Column(String(50), nullable=False, index=True, comment="数据来源")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    __table_args__ = (
        Index('idx_top_inst_date', 'trade_date'),
        Index('idx_top_inst_code', 'ts_code'),
        Index('idx_top_inst_exalter', 'exalter'),
        # 按交易日期+股票代码+营业部去重
        Index('idx_top_inst_date_code_exalter', 'trade_date', 'ts_code', 'exalter', unique=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "trade_date": self.trade_date,
            "ts_code": self.ts_code,
            "exalter": self.exalter,
            "buy": self.buy,
            "buy_rate": self.buy_rate,
            "sell": self.sell,
            "sell_rate": self.sell_rate,
            "net_buy": self.net_buy,
            "side": self.side,
            "reason": self.reason,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

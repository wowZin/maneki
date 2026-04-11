"""
多数据源服务
支持 Akshare (免费) 和 Tushare Pro (付费) 根据用户等级自动切换
"""

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional, Dict, Any, Callable
from datetime import datetime, date
import logging

import pandas as pd

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


@dataclass
class StockData:
    """标准化股票数据结构"""
    code: str
    name: str
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    amount: Optional[Decimal] = None
    change_pct: Optional[Decimal] = None


@dataclass
class KLineData:
    """K线数据结构"""
    code: str
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    amount: Decimal


class DataSource(ABC):
    """数据源抽象基类"""

    name: str = "base"
    requires_vip: int = 0  # 0=免费, 1=VIP, 2=SVIP

    @abstractmethod
    async def get_stock_list(self) -> List[Dict[str, str]]:
        """获取股票列表"""
        pass

    @abstractmethod
    async def get_kline(
        self,
        code: str,
        period: str = "daily",  # daily/weekly/monthly/minutely
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjust: str = "qfq"  # qfq=前复权, hfq=后复权, 空=不复权
    ) -> List[KLineData]:
        """获取K线数据"""
        pass

    @abstractmethod
    async def get_realtime_quote(self, code: str) -> Optional[StockData]:
        """获取实时行情"""
        pass

    @abstractmethod
    async def get_realtime_quotes(self, codes: Optional[List[str]] = None) -> List[StockData]:
        """批量获取实时行情"""
        pass


class AkshareDataSource(DataSource):
    """
    Akshare 数据源 (免费)
    适用于：开发阶段、免费用户、基础数据获取
    """

    name = "akshare"
    requires_vip = 0

    def __init__(self):
        self._ak = None
        self._ensure_import()

    def _ensure_import(self):
        """延迟导入，避免启动时依赖"""
        if self._ak is None:
            try:
                import akshare as ak
                self._ak = ak
                logger.info("Akshare 数据源初始化成功")
            except ImportError:
                logger.error("Akshare 未安装，请运行: pip install akshare")
                raise

    async def get_stock_list(self) -> List[Dict[str, str]]:
        """获取A股列表"""
        loop = asyncio.get_event_loop()

        def _fetch():
            df = self._ak.stock_zh_a_spot_em()
            return [
                {
                    "code": row["代码"],
                    "name": row["名称"],
                }
                for _, row in df.iterrows()
            ]

        return await loop.run_in_executor(None, _fetch)

    async def get_kline(
        self,
        code: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjust: str = "qfq"
    ) -> List[KLineData]:
        """获取K线数据"""
        loop = asyncio.get_event_loop()

        def _fetch():
            # 映射周期
            period_map = {
                "daily": "daily",
                "weekly": "weekly",
                "monthly": "monthly",
            }

            if period in period_map:
                df = self._ak.stock_zh_a_hist(
                    symbol=code,
                    period=period_map[period],
                    start_date=start_date or "19700101",
                    end_date=end_date or datetime.now().strftime("%Y%m%d"),
                    adjust=adjust
                )
            elif period == "minutely":
                # 分钟线使用不同接口
                df = self._ak.stock_zh_a_hist_min_em(symbol=code, period="1")
            else:
                raise ValueError(f"不支持的周期: {period}")

            # 转换为标准格式
            klines = []
            for _, row in df.iterrows():
                klines.append(KLineData(
                    code=code,
                    timestamp=pd.to_datetime(row.get("日期", row.get("时间"))),
                    open=Decimal(str(row.get("开盘", row.get("开盘价", 0)))),
                    high=Decimal(str(row.get("最高", row.get("最高价", 0)))),
                    low=Decimal(str(row.get("最低", row.get("最低价", 0)))),
                    close=Decimal(str(row.get("收盘", row.get("收盘价", 0)))),
                    volume=int(row.get("成交量", 0)),
                    amount=Decimal(str(row.get("成交额", 0))),
                ))
            return klines

        return await loop.run_in_executor(None, _fetch)

    async def get_realtime_quote(self, code: str) -> Optional[StockData]:
        """获取实时行情"""
        quotes = await self.get_realtime_quotes([code])
        return quotes[0] if quotes else None

    async def get_realtime_quotes(self, codes: Optional[List[str]] = None) -> List[StockData]:
        """获取实时行情（3秒延迟）"""
        loop = asyncio.get_event_loop()

        def _fetch():
            df = self._ak.stock_zh_a_spot_em()

            if codes:
                df = df[df["代码"].isin(codes)]

            quotes = []
            for _, row in df.iterrows():
                quotes.append(StockData(
                    code=row["代码"],
                    name=row["名称"],
                    timestamp=datetime.now(),
                    open=Decimal(str(row.get("今开", 0))),
                    high=Decimal(str(row.get("最高", 0))),
                    low=Decimal(str(row.get("最低", 0))),
                    close=Decimal(str(row.get("最新价", 0))),
                    volume=int(row.get("成交量", 0) or 0),
                    amount=Decimal(str(row.get("成交额", 0) or 0)),
                    change_pct=Decimal(str(row.get("涨跌幅", 0) or 0)),
                ))
            return quotes

        return await loop.run_in_executor(None, _fetch)

    async def get_indicators(self, code: str) -> Dict[str, Any]:
        """获取技术指标（Akshare自带）"""
        loop = asyncio.get_event_loop()

        def _fetch():
            # 获取个股指标
            df = self._ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")

            if df.empty:
                return {}

            latest = df.iloc[-1]

            return {
                "ma5": float(df["收盘"].tail(5).mean()),
                "ma10": float(df["收盘"].tail(10).mean()),
                "ma20": float(df["收盘"].tail(20).mean()),
                "volume_ma5": float(df["成交量"].tail(5).mean()),
                "high_20d": float(df["最高"].tail(20).max()),
                "low_20d": float(df["最低"].tail(20).min()),
            }

        return await loop.run_in_executor(None, _fetch)


class TushareDataSource(DataSource):
    """
    Tushare Pro 数据源 (付费)
    适用于：VIP/SVIP 用户、高质量数据需求
    特点：数据更稳定、有官方支持、更高调取频率
    """

    name = "tushare"
    requires_vip = 1  # VIP 及以上可用

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.TUSHARE_TOKEN
        self._pro = None
        self._ensure_import()

    def _ensure_import(self):
        """延迟导入"""
        if self._pro is None:
            try:
                import tushare as ts
                if not self.token:
                    raise ValueError("Tushare token 未配置")
                ts.set_token(self.token)
                self._pro = ts.pro_api()
                logger.info("Tushare Pro 数据源初始化成功")
            except ImportError:
                logger.error("Tushare 未安装，请运行: pip install tushare")
                raise

    async def get_stock_list(self) -> List[Dict[str, str]]:
        """获取股票列表"""
        loop = asyncio.get_event_loop()

        def _fetch():
            df = self._pro.stock_basic(exchange="", list_status="L")
            return [
                {
                    "code": row["ts_code"].split(".")[0],
                    "name": row["name"],
                    "list_date": row.get("list_date"),
                }
                for _, row in df.iterrows()
            ]

        return await loop.run_in_executor(None, _fetch)

    async def get_kline(
        self,
        code: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjust: str = "qfq"
    ) -> List[KLineData]:
        """获取K线数据"""
        loop = asyncio.get_event_loop()

        def _fetch():
            # 转换代码格式 (000001.SZ)
            ts_code = self._to_ts_code(code)

            # 映射周期
            freq_map = {
                "daily": "D",
                "weekly": "W",
                "monthly": "M",
            }

            if period in freq_map:
                df = self._pro.daily(
                    ts_code=ts_code,
                    start_date=start_date,
                    end_date=end_date,
                )
            elif period == "minutely":
                # Tushare 分钟线需要更高权限
                df = self._pro.minute(
                    ts_code=ts_code,
                    start_date=start_date,
                    end_date=end_date,
                )
            else:
                raise ValueError(f"不支持的周期: {period}")

            if df is None or df.empty:
                return []

            klines = []
            for _, row in df.iterrows():
                klines.append(KLineData(
                    code=code,
                    timestamp=pd.to_datetime(row["trade_date"]),
                    open=Decimal(str(row["open"])),
                    high=Decimal(str(row["high"])),
                    low=Decimal(str(row["low"])),
                    close=Decimal(str(row["close"])),
                    volume=int(row["vol"] * 100),  # Tushare 是手，转股
                    amount=Decimal(str(row["amount"] * 1000)),  # 千元转元
                ))
            return klines

        return await loop.run_in_executor(None, _fetch)

    async def get_realtime_quote(self, code: str) -> Optional[StockData]:
        """获取实时行情"""
        # Tushare 实时行情需要特殊权限
        # 这里可以使用通用行情接口
        loop = asyncio.get_event_loop()

        def _fetch():
            ts_code = self._to_ts_code(code)
            df = self._pro.quotation(ts_code=ts_code)

            if df is None or df.empty:
                return None

            row = df.iloc[0]
            return StockData(
                code=code,
                name=row.get("name", ""),
                timestamp=datetime.now(),
                open=Decimal(str(row.get("open", 0))),
                high=Decimal(str(row.get("high", 0))),
                low=Decimal(str(row.get("low", 0))),
                close=Decimal(str(row.get("price", 0))),
                volume=int(row.get("vol", 0)),
                amount=Decimal(str(row.get("amount", 0))),
                change_pct=Decimal(str(row.get("changepercent", 0))),
            )

        return await loop.run_in_executor(None, _fetch)

    async def get_realtime_quotes(self, codes: Optional[List[str]] = None) -> List[StockData]:
        """批量获取实时行情"""
        if not codes:
            return []

        quotes = []
        for code in codes:
            quote = await self.get_realtime_quote(code)
            if quote:
                quotes.append(quote)
        return quotes

    def _to_ts_code(self, code: str) -> str:
        """转换为 Tushare 代码格式"""
        # 简单规则：6开头是上海，其他是深圳
        if code.startswith("6"):
            return f"{code}.SH"
        return f"{code}.SZ"


class DataProvider:
    """
    数据提供者
    根据用户等级自动选择合适的数据源
    """

    _instance = None
    _data_sources: Dict[str, DataSource] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_sources()
        return cls._instance

    def _init_sources(self):
        """初始化数据源"""
        # 免费数据源（始终可用）
        if settings.AKSHARE_ENABLED:
            try:
                self._data_sources["akshare"] = AkshareDataSource()
            except Exception as e:
                logger.error(f"Akshare 初始化失败: {e}")

        # 付费数据源（配置token后可用）
        if settings.TUSHARE_ENABLED and settings.TUSHARE_TOKEN:
            try:
                self._data_sources["tushare"] = TushareDataSource()
            except Exception as e:
                logger.error(f"Tushare 初始化失败: {e}")

    def get_data_source(self, user: Optional[User] = None) -> DataSource:
        """
        根据用户等级获取合适的数据源

        策略：
        - free: 所有用户使用 Akshare
        - tiered: 免费用户 Akshare, VIP/SVIP 使用 Tushare Pro
        """
        vip_level = user.vip_level if user else 0

        if settings.DATA_SOURCE_STRATEGY == "tiered":
            # 分层策略
            if vip_level >= 1 and "tushare" in self._data_sources:
                logger.debug(f"用户 {user.id} 使用 Tushare Pro 数据源")
                return self._data_sources["tushare"]
            else:
                logger.debug(f"用户 {user.id} 使用 Akshare 数据源")
                return self._data_sources.get("akshare")
        else:
            # 免费策略：所有人都用 Akshare
            return self._data_sources.get("akshare")

    def get_data_source_by_name(self, name: str) -> Optional[DataSource]:
        """通过名称获取数据源（用于测试/调试）"""
        return self._data_sources.get(name)

    @property
    def available_sources(self) -> List[str]:
        """获取可用数据源列表"""
        return list(self._data_sources.keys())

    async def health_check(self) -> Dict[str, bool]:
        """健康检查"""
        results = {}
        for name, source in self._data_sources.items():
            try:
                # 尝试获取一只股票的数据
                if name == "akshare":
                    await source.get_realtime_quote("000001")  # 平安银行
                else:
                    await source.get_kline("000001", start_date="20240101", end_date="20240102")
                results[name] = True
            except Exception as e:
                logger.error(f"{name} 健康检查失败: {e}")
                results[name] = False
        return results


# 便捷函数
def get_data_provider() -> DataProvider:
    """获取数据提供者实例"""
    return DataProvider()


async def get_stock_data(
    code: str,
    user: Optional[User] = None,
    **kwargs
) -> List[KLineData]:
    """
    便捷函数：获取股票数据
    自动根据用户等级选择数据源
    """
    provider = get_data_provider()
    source = provider.get_data_source(user)

    if not source:
        raise RuntimeError("没有可用的数据源")

    return await source.get_kline(code, **kwargs)

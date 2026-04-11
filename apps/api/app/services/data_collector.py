"""
数据采集服务
集成 Akshare 获取股票实时行情数据
"""

import asyncio
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional, Any

import akshare as ak
from loguru import logger

from app.db.session import get_db_session
from app.models.stock import Stock
from app.models.kline import KLine1Min
from app.core.config import settings


class DataCollector:
    """数据采集器"""

    def __init__(self):
        self.is_running = False
        self.monitored_stocks: List[str] = []

    async def get_all_stocks(self) -> List[Dict[str, Any]]:
        """
        获取所有A股股票列表
        """
        try:
            # 使用 akshare 获取股票列表
            # 注意：akshare 是同步库，需要在线程池中运行
            df = await asyncio.to_thread(ak.stock_zh_a_spot_em)

            stocks = []
            for _, row in df.iterrows():
                stock_code = str(row.get('代码', ''))
                stock_name = str(row.get('名称', ''))

                # 判断市场
                if stock_code.startswith('6'):
                    market = 'SH'
                elif stock_code.startswith('0') or stock_code.startswith('3'):
                    market = 'SZ'
                elif stock_code.startswith('8') or stock_code.startswith('4'):
                    market = 'BJ'
                else:
                    market = 'SZ'

                stocks.append({
                    'code': f"{stock_code}.{market}",
                    'name': stock_name,
                    'market': market,
                    'industry': str(row.get('所属行业', '')),
                })

            logger.info(f"获取到 {len(stocks)} 只股票")
            return stocks

        except Exception as e:
            logger.error(f"获取股票列表失败: {e}")
            return []

    async def sync_stock_list(self):
        """
        同步股票列表到数据库
        """
        stocks = await self.get_all_stocks()

        async with get_db_session() as session:
            for stock_data in stocks[:500]:  # 先同步前500只
                try:
                    # 检查是否已存在
                    existing = await session.get(Stock, stock_data['code'])
                    if not existing:
                        stock = Stock(**stock_data)
                        session.add(stock)
                        logger.debug(f"添加股票: {stock_data['code']}")

                except Exception as e:
                    logger.error(f"同步股票 {stock_data['code']} 失败: {e}")

        logger.info(f"股票列表同步完成，共 {len(stocks)} 只")

    async def get_stock_kline_min(
        self,
        code: str,
        period: str = "1",
        days: int = 1
    ) -> List[Dict[str, Any]]:
        """
        获取股票分钟K线数据

        Args:
            code: 股票代码 (如: 000001.SZ)
            period: 分钟周期 (1/5/15/30/60)
            days: 获取天数
        """
        try:
            # 解析代码
            code_parts = code.split('.')
            stock_code = code_parts[0]
            market = code_parts[1] if len(code_parts) > 1 else 'SZ'

            # 映射市场代码
            if market == 'SH':
                ak_code = f"sh{stock_code}"
            else:
                ak_code = f"sz{stock_code}"

            # 获取分钟数据
            df = await asyncio.to_thread(
                ak.stock_zh_a_hist_min_em,
                symbol=stock_code,
                period=period,
                adjust="qfq"
            )

            if df.empty:
                return []

            klines = []
            for _, row in df.iterrows():
                try:
                    time_str = str(row.get('时间', ''))
                    dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M")

                    klines.append({
                        'code': code,
                        'time': dt,
                        'open': Decimal(str(row.get('开盘', 0))),
                        'high': Decimal(str(row.get('最高', 0))),
                        'low': Decimal(str(row.get('最低', 0))),
                        'close': Decimal(str(row.get('收盘', 0))),
                        'volume': int(row.get('成交量', 0)),
                        'amount': Decimal(str(row.get('成交额', 0))),
                    })
                except Exception as e:
                    logger.warning(f"解析K线数据失败: {e}")
                    continue

            return klines

        except Exception as e:
            logger.error(f"获取 {code} 分钟K线失败: {e}")
            return []

    async def get_realtime_quotes(self, codes: List[str]) -> Dict[str, Dict]:
        """
        获取实时行情（单批次）
        """
        try:
            # 获取实时行情
            df = await asyncio.to_thread(ak.stock_zh_a_spot_em)

            quotes = {}
            for _, row in df.iterrows():
                code = str(row.get('代码', ''))
                full_code = f"{code}.{'SH' if code.startswith('6') else 'SZ'}"

                if full_code in codes:
                    quotes[full_code] = {
                        'code': full_code,
                        'name': str(row.get('名称', '')),
                        'price': float(row.get('最新价', 0) or 0),
                        'change_pct': float(row.get('涨跌幅', 0) or 0),
                        'volume': int(row.get('成交量', 0) or 0),
                        'amount': float(row.get('成交额', 0) or 0),
                        'high': float(row.get('最高', 0) or 0),
                        'low': float(row.get('最低', 0) or 0),
                        'open': float(row.get('今开', 0) or 0),
                        'pre_close': float(row.get('昨收', 0) or 0),
                        'timestamp': datetime.now(),
                    }

            return quotes

        except Exception as e:
            logger.error(f"获取实时行情失败: {e}")
            return {}

    async def start_monitoring(self, stock_codes: Optional[List[str]] = None):
        """
        开始监控股票
        """
        if stock_codes:
            self.monitored_stocks = stock_codes
        else:
            # 默认监控前200只
            stocks = await self.get_all_stocks()
            self.monitored_stocks = [s['code'] for s in stocks[:settings.MONITOR_STOCK_COUNT]]

        self.is_running = True
        logger.info(f"开始监控 {len(self.monitored_stocks)} 只股票")

    async def stop_monitoring(self):
        """停止监控"""
        self.is_running = False
        logger.info("停止监控")

    async def collect_once(self) -> Dict[str, Any]:
        """
        单次采集（用于定时任务）
        返回采集的统计数据
        """
        if not self.monitored_stocks:
            await self.start_monitoring()

        stats = {
            'timestamp': datetime.now(),
            'stocks_count': len(self.monitored_stocks),
            'quotes_collected': 0,
            'errors': [],
        }

        try:
            # 获取实时行情
            quotes = await self.get_realtime_quotes(self.monitored_stocks)
            stats['quotes_collected'] = len(quotes)

            # 保存到 Redis（缓存）
            # TODO: 实现 Redis 缓存

            logger.info(f"单次采集完成: {stats['quotes_collected']} 只股票")

        except Exception as e:
            logger.error(f"单次采集失败: {e}")
            stats['errors'].append(str(e))

        return stats


# 全局采集器实例
data_collector = DataCollector()

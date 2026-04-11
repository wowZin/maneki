"""
实时计算引擎
技术指标计算和信号检测
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Any

import numpy as np
from loguru import logger

from app.db.session import get_db_session
from app.models.kline import KLine1Min
from app.models.indicator import Indicator


class RealTimeEngine:
    """实时计算引擎"""

    def __init__(self):
        self.indicators_cache: Dict[str, Dict] = {}  # 指标缓存

    def calculate_ma(self, prices: np.ndarray, periods: List[int]) -> Dict[int, float]:
        """
        计算移动平均线

        Args:
            prices: 价格数组
            periods: 周期列表 [5, 10, 20]

        Returns:
            {period: ma_value}
        """
        result = {}
        for period in periods:
            if len(prices) >= period:
                ma = np.mean(prices[-period:])
                result[period] = round(float(ma), 4)
            else:
                result[period] = None
        return result

    def calculate_macd(
        self,
        prices: np.ndarray,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Dict[str, float]:
        """
        计算MACD指标

        Returns:
            {'dif': float, 'dea': float, 'hist': float}
        """
        if len(prices) < slow:
            return {'dif': None, 'dea': None, 'hist': None}

        # 计算EMA
        def ema(data, period):
            alpha = 2 / (period + 1)
            result = [data[0]]
            for i in range(1, len(data)):
                result.append(alpha * data[i] + (1 - alpha) * result[i-1])
            return np.array(result)

        ema_fast = ema(prices, fast)
        ema_slow = ema(prices, slow)

        dif = ema_fast - ema_slow
        dea = ema(dif, signal)
        hist = dif - dea

        return {
            'dif': round(float(dif[-1]), 4),
            'dea': round(float(dea[-1]), 4),
            'hist': round(float(hist[-1]), 4)
        }

    def calculate_kdj(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        n: int = 9,
        m1: int = 3,
        m2: int = 3
    ) -> Dict[str, float]:
        """
        计算KDJ指标

        Returns:
            {'k': float, 'd': float, 'j': float}
        """
        if len(closes) < n:
            return {'k': None, 'd': None, 'j': None}

        # RSV
        rsv = np.zeros(len(closes))
        for i in range(n-1, len(closes)):
            high_n = np.max(highs[i-n+1:i+1])
            low_n = np.min(lows[i-n+1:i+1])
            if high_n != low_n:
                rsv[i] = 100 * (closes[i] - low_n) / (high_n - low_n)

        # K, D, J
        k = np.zeros(len(closes))
        d = np.zeros(len(closes))
        k[0] = 50
        d[0] = 50

        for i in range(1, len(closes)):
            k[i] = (2/3) * k[i-1] + (1/3) * rsv[i]
            d[i] = (2/3) * d[i-1] + (1/3) * k[i]

        j = 3 * k - 2 * d

        return {
            'k': round(float(k[-1]), 2),
            'd': round(float(d[-1]), 2),
            'j': round(float(j[-1]), 2)
        }

    def calculate_rsi(self, prices: np.ndarray, periods: List[int] = [6, 12, 24]) -> Dict[int, float]:
        """
        计算RSI指标

        Returns:
            {period: rsi_value}
        """
        result = {}
        deltas = np.diff(prices)

        for period in periods:
            if len(deltas) < period:
                result[period] = None
                continue

            gains = deltas[-period:].copy()
            losses = deltas[-period:].copy()

            gains[gains < 0] = 0
            losses[losses > 0] = 0
            losses = np.abs(losses)

            avg_gain = np.mean(gains)
            avg_loss = np.mean(losses)

            if avg_loss == 0:
                rsi = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))

            result[period] = round(float(rsi), 2)

        return result

    async def calculate_indicators(
        self,
        code: str,
        klines: List[Dict[str, Any]]
    ) -> Optional[Indicator]:
        """
        计算指定股票的所有技术指标

        Args:
            code: 股票代码
            klines: K线数据列表

        Returns:
            Indicator 对象
        """
        if len(klines) < 60:  # 至少需要60条数据
            logger.warning(f"{code} K线数据不足: {len(klines)}")
            return None

        try:
            # 提取价格数据
            closes = np.array([float(k['close']) for k in klines])
            highs = np.array([float(k['high']) for k in klines])
            lows = np.array([float(k['low']) for k in klines])
            volumes = np.array([int(k['volume']) for k in klines])

            # 计算指标
            ma_values = self.calculate_ma(closes, [5, 10, 20, 60])
            macd_values = self.calculate_macd(closes)
            kdj_values = self.calculate_kdj(highs, lows, closes)
            rsi_values = self.calculate_rsi(closes, [6, 12, 24])

            # 成交量指标
            volume_ma5 = np.mean(volumes[-5:]) if len(volumes) >= 5 else None

            # 创建指标对象
            latest_kline = klines[-1]
            indicator = Indicator(
                time=latest_kline['time'],
                code=code,
                ma5=Decimal(str(ma_values[5])) if ma_values[5] else None,
                ma10=Decimal(str(ma_values[10])) if ma_values[10] else None,
                ma20=Decimal(str(ma_values[20])) if ma_values[20] else None,
                ma60=Decimal(str(ma_values[60])) if ma_values[60] else None,
                macd_dif=Decimal(str(macd_values['dif'])) if macd_values['dif'] else None,
                macd_dea=Decimal(str(macd_values['dea'])) if macd_values['dea'] else None,
                macd_hist=Decimal(str(macd_values['hist'])) if macd_values['hist'] else None,
                kdj_k=Decimal(str(kdj_values['k'])) if kdj_values['k'] else None,
                kdj_d=Decimal(str(kdj_values['d'])) if kdj_values['d'] else None,
                kdj_j=Decimal(str(kdj_values['j'])) if kdj_values['j'] else None,
                rsi6=Decimal(str(rsi_values[6])) if rsi_values[6] else None,
                rsi12=Decimal(str(rsi_values[12])) if rsi_values[12] else None,
                rsi24=Decimal(str(rsi_values[24])) if rsi_values[24] else None,
                volume_ma5=int(volume_ma5) if volume_ma5 else None,
            )

            return indicator

        except Exception as e:
            logger.error(f"计算 {code} 指标失败: {e}")
            return None

    async def process_batch(self, stock_codes: List[str]):
        """
        批量处理股票指标计算
        """
        from app.services.data_collector import data_collector

        logger.info(f"开始批量计算 {len(stock_codes)} 只股票的指标")

        for code in stock_codes:
            try:
                # 获取K线数据
                klines = await data_collector.get_stock_kline_min(code, period="1", days=1)

                if not klines:
                    continue

                # 计算指标
                indicator = await self.calculate_indicators(code, klines)

                if indicator:
                    # 保存到数据库
                    async with get_db_session() as session:
                        session.add(indicator)

                    # 更新缓存
                    self.indicators_cache[code] = {
                        'timestamp': datetime.now(),
                        'indicator': indicator
                    }

                    logger.debug(f"{code} 指标计算完成")

            except Exception as e:
                logger.error(f"处理 {code} 失败: {e}")

        logger.info("批量指标计算完成")


# 全局引擎实例
real_time_engine = RealTimeEngine()

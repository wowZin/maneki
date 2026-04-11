"""
信号生成器
根据技术指标和Agent决策生成交易信号
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List

from loguru import logger

from app.db.session import get_db_session
from app.models.signal import Signal
from app.models.indicator import Indicator
from app.core.config import settings


class SignalGenerator:
    """信号生成器"""

    def __init__(self):
        self.signal_rules = {
            'breakout': self.check_breakout,
            'macd_cross': self.check_macd_cross,
            'kdj_cross': self.check_kdj_cross,
            'volume_spike': self.check_volume_spike,
        }

    def check_breakout(
        self,
        code: str,
        current_price: float,
        indicator: Indicator,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        突破信号检测
        价格突破MA20且成交量放大
        """
        if not indicator.ma20:
            return None

        ma20 = float(indicator.ma20)
        volume_ma5 = indicator.volume_ma5 or 0
        current_volume = kwargs.get('volume', 0)

        # 价格突破MA20 2%以上
        if current_price > ma20 * 1.02:
            # 成交量是5日均量的1.5倍以上
            if current_volume > volume_ma5 * 1.5:
                return {
                    'type': 'buy',
                    'confidence': 0.75,
                    'reason': f'价格突破MA20({ma20:.2f})且成交量放大',
                    'trigger_price': Decimal(str(current_price)),
                }

        return None

    def check_macd_cross(
        self,
        code: str,
        current_price: float,
        indicator: Indicator,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        MACD金叉信号检测
        """
        if not indicator.macd_dif or not indicator.macd_dea:
            return None

        dif = float(indicator.macd_dif)
        dea = float(indicator.macd_dea)
        hist = float(indicator.macd_hist) if indicator.macd_hist else 0

        # DIF上穿DEA且柱状图为正
        if dif > dea and hist > 0:
            return {
                'type': 'buy',
                'confidence': 0.70,
                'reason': f'MACD金叉(DIF={dif:.3f}, DEA={dea:.3f})',
                'trigger_price': Decimal(str(current_price)),
            }

        return None

    def check_kdj_cross(
        self,
        code: str,
        current_price: float,
        indicator: Indicator,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        KDJ金叉信号检测
        """
        if not indicator.kdj_k or not indicator.kdj_d:
            return None

        k = float(indicator.kdj_k)
        d = float(indicator.kdj_d)

        # K上穿D且K值在20-50之间（低位金叉）
        if k > d and 20 < k < 50:
            return {
                'type': 'buy',
                'confidence': 0.65,
                'reason': f'KDJ低位金叉(K={k:.2f}, D={d:.2f})',
                'trigger_price': Decimal(str(current_price)),
            }

        return None

    def check_volume_spike(
        self,
        code: str,
        current_price: float,
        indicator: Indicator,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        成交量突增信号
        """
        volume_ma5 = indicator.volume_ma5 or 0
        current_volume = kwargs.get('volume', 0)

        # 成交量是5日均量的3倍以上
        if volume_ma5 > 0 and current_volume > volume_ma5 * 3:
            return {
                'type': 'watch',
                'confidence': 0.60,
                'reason': f'成交量突增({current_volume/volume_ma5:.1f}倍)',
                'trigger_price': Decimal(str(current_price)),
            }

        return None

    async def generate_signal(
        self,
        code: str,
        current_price: float,
        indicator: Indicator,
        **kwargs
    ) -> Optional[Signal]:
        """
        生成交易信号

        综合所有规则，生成最高置信度的信号
        """
        best_signal = None
        best_confidence = 0

        # 遍历所有规则
        for rule_name, rule_func in self.signal_rules.items():
            try:
                result = rule_func(code, current_price, indicator, **kwargs)

                if result and result['confidence'] > best_confidence:
                    best_confidence = result['confidence']
                    best_signal = result
                    best_signal['rule'] = rule_name

            except Exception as e:
                logger.error(f"规则 {rule_name} 执行失败: {e}")

        # 检查置信度阈值
        if best_signal and best_signal['confidence'] >= settings.SIGNAL_THRESHOLD:
            signal = Signal(
                code=code,
                signal_type=best_signal['type'],
                confidence=Decimal(str(best_signal['confidence'])),
                trigger_price=best_signal['trigger_price'],
                reason=best_signal['reason'],
                metadata={
                    'rule': best_signal['rule'],
                    'timestamp': datetime.now().isoformat(),
                }
            )

            # 保存到数据库
            async with get_db_session() as session:
                session.add(signal)

            logger.info(f"生成信号: {code} - {best_signal['type']} - {best_signal['confidence']}")
            return signal

        return None

    async def check_limit_up_potential(
        self,
        code: str,
        current_price: float,
        indicator: Indicator,
        **kwargs
    ) -> Optional[Signal]:
        """
        涨停潜力检测（核心功能）

        综合多个指标判断涨停可能性
        """
        score = 0.0
        reasons = []

        # 1. 价格接近涨停（涨幅 > 7%）
        pre_close = kwargs.get('pre_close', current_price)
        change_pct = (current_price - pre_close) / pre_close * 100

        if change_pct > 7:
            score += 0.3
            reasons.append(f"涨幅{change_pct:.1f}%接近涨停")

        # 2. MACD强势
        if indicator.macd_hist and float(indicator.macd_hist) > 0:
            score += 0.2
            reasons.append("MACD红柱")

        # 3. KDJ强势
        if indicator.kdj_j and float(indicator.kdj_j) > 50:
            score += 0.2
            reasons.append("KDJ强势")

        # 4. 成交量放大
        volume_ma5 = indicator.volume_ma5 or 0
        current_volume = kwargs.get('volume', 0)
        if volume_ma5 > 0 and current_volume > volume_ma5 * 2:
            score += 0.3
            reasons.append("成交量放大")

        # 综合判断
        if score >= 0.7:
            signal = Signal(
                code=code,
                signal_type='buy',
                confidence=Decimal(str(min(score, 0.95))),
                trigger_price=Decimal(str(current_price)),
                reason='; '.join(reasons),
                metadata={
                    'type': 'limit_up_potential',
                    'score': score,
                    'change_pct': change_pct,
                }
            )

            async with get_db_session() as session:
                session.add(signal)

            logger.info(f"🔥 涨停潜力信号: {code} - 得分 {score:.2f}")
            return signal

        return None


# 全局信号生成器实例
signal_generator = SignalGenerator()

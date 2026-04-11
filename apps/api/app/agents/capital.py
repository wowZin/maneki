"""
资金分析Agent
基于资金流向进行决策
"""

from decimal import Decimal
from typing import Dict, Any, Optional

from app.agents.base import BaseAgent, AgentVote


class CapitalAgent(BaseAgent):
    """资金流向分析Agent"""

    def __init__(self, weight: Decimal = Decimal("0.9")):
        super().__init__("资金分析Agent", weight)

    async def analyze(
        self,
        code: str,
        current_price: float,
        indicator_data: Dict[str, Any],
        **kwargs
    ) -> Optional[AgentVote]:
        """
        基于资金流向分析

        简化版：使用成交量和量价关系
        """
        factors = {}
        reasons = []

        # 获取数据
        volume_ma5 = indicator_data.get('volume_ma5', 0)
        current_volume = kwargs.get('volume', 0)
        change_pct = kwargs.get('change_pct', 0)

        # 1. 成交量趋势
        if volume_ma5 > 0:
            volume_ratio = current_volume / volume_ma5

            if volume_ratio > 3:
                factors['volume_trend'] = 0.9
                reasons.append(f"巨量({volume_ratio:.1f}倍均量)")
            elif volume_ratio > 2:
                factors['volume_trend'] = 0.75
                reasons.append(f"大量({volume_ratio:.1f}倍均量)")
            elif volume_ratio > 1:
                factors['volume_trend'] = 0.6
                reasons.append(f"放量({volume_ratio:.1f}倍均量)")
            else:
                factors['volume_trend'] = 0.4
                reasons.append("缩量")

        # 2. 量价配合
        if change_pct > 0 and current_volume > volume_ma5 * 1.5:
            # 价涨量增 - 健康
            factors['price_volume'] = 0.85
            reasons.append("价涨量增")
        elif change_pct > 0 and current_volume < volume_ma5 * 0.8:
            # 价涨量缩 - 背离
            factors['price_volume'] = 0.4
            reasons.append("价涨量缩(背离)")
        elif change_pct < 0 and current_volume > volume_ma5 * 2:
            # 价跌量增 - 恐慌
            factors['price_volume'] = 0.2
            reasons.append("价跌量增(恐慌)")
        else:
            factors['price_volume'] = 0.5

        # 3. 大单资金（模拟）
        # 实际项目中应该获取真实的大单数据
        large_order_ratio = kwargs.get('large_order_ratio', 0.5)
        if large_order_ratio > 0.6:
            factors['capital_inflow'] = 0.9
            reasons.append("大单流入")
        elif large_order_ratio < 0.4:
            factors['capital_inflow'] = 0.2
            reasons.append("大单流出")
        else:
            factors['capital_inflow'] = 0.5

        # 计算综合得分
        confidence = self.calculate_confidence(factors)

        # 资金Agent更关注成交量
        if confidence >= Decimal("0.7"):
            decision = "buy"
        elif confidence <= Decimal("0.3"):
            decision = "sell"
        else:
            decision = "hold"

        vote = AgentVote(
            agent_type="capital",
            decision=decision,
            score=confidence,
            reasoning="; ".join(reasons),
            weight=self.weight
        )

        self.log_decision(vote)
        return vote

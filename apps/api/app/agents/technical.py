"""
技术分析Agent
基于技术指标进行决策
"""

from decimal import Decimal
from typing import Dict, Any, Optional

from app.agents.base import BaseAgent, AgentVote


class TechnicalAnalysisAgent(BaseAgent):
    """技术分析Agent"""

    def __init__(self, weight: Decimal = Decimal("1.0")):
        super().__init__("技术分析Agent", weight)

    async def analyze(
        self,
        code: str,
        current_price: float,
        indicator_data: Dict[str, Any],
        **kwargs
    ) -> Optional[AgentVote]:
        """
        基于技术指标分析
        """
        factors = {}
        reasons = []

        # 1. 移动平均线分析
        ma5 = indicator_data.get('ma5')
        ma10 = indicator_data.get('ma10')
        ma20 = indicator_data.get('ma20')

        if ma5 and ma10 and ma20:
            # 多头排列: MA5 > MA10 > MA20
            if ma5 > ma10 > ma20:
                factors['ma_alignment'] = 0.9
                reasons.append("多头排列(MA5>MA10>MA20)")
            # 空头排列
            elif ma5 < ma10 < ma20:
                factors['ma_alignment'] = 0.1
                reasons.append("空头排列")
            else:
                factors['ma_alignment'] = 0.5

            # 价格在MA20之上
            if current_price > ma20:
                factors['price_above_ma20'] = 0.8
                reasons.append("价格在MA20之上")
            else:
                factors['price_above_ma20'] = 0.3

        # 2. MACD分析
        macd_hist = indicator_data.get('macd_hist')
        if macd_hist:
            if macd_hist > 0:
                factors['macd'] = min(0.5 + abs(macd_hist) * 10, 0.9)
                reasons.append(f"MACD红柱({macd_hist:.3f})")
            else:
                factors['macd'] = max(0.5 - abs(macd_hist) * 10, 0.1)
                reasons.append(f"MACD绿柱({macd_hist:.3f})")

        # 3. KDJ分析
        kdj_k = indicator_data.get('kdj_k')
        kdj_d = indicator_data.get('kdj_d')
        kdj_j = indicator_data.get('kdj_j')

        if kdj_k is not None and kdj_d is not None:
            # K上穿D (金叉)
            if kdj_k > kdj_d and kdj_k < 50:
                factors['kdj'] = 0.8
                reasons.append(f"KDJ低位金叉(K={kdj_k:.1f})")
            # K下穿D (死叉)
            elif kdj_k < kdj_d and kdj_k > 50:
                factors['kdj'] = 0.2
                reasons.append(f"KDJ高位死叉(K={kdj_k:.1f})")
            else:
                factors['kdj'] = 0.5

            # J值判断超买超卖
            if kdj_j > 100:
                factors['kdj_j'] = 0.2
                reasons.append("KDJ超买")
            elif kdj_j < 0:
                factors['kdj_j'] = 0.8
                reasons.append("KDJ超卖")

        # 4. RSI分析
        rsi6 = indicator_data.get('rsi6')
        if rsi6:
            if rsi6 < 30:
                factors['rsi'] = 0.8
                reasons.append(f"RSI超卖({rsi6:.1f})")
            elif rsi6 > 70:
                factors['rsi'] = 0.2
                reasons.append(f"RSI超买({rsi6:.1f})")
            else:
                factors['rsi'] = 0.5 + (rsi6 - 50) / 100

        # 计算综合得分
        confidence = self.calculate_confidence(factors)

        # 决策判断
        if confidence >= Decimal("0.7"):
            decision = "buy"
        elif confidence <= Decimal("0.3"):
            decision = "sell"
        else:
            decision = "hold"

        vote = AgentVote(
            agent_type="technical",
            decision=decision,
            score=confidence,
            reasoning="; ".join(reasons) if reasons else "指标中性",
            weight=self.weight
        )

        self.log_decision(vote)
        return vote

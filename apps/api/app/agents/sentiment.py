"""
情绪分析Agent
基于市场情绪进行决策
"""

from decimal import Decimal
from typing import Dict, Any, Optional

from app.agents.base import BaseAgent, AgentVote


class SentimentAgent(BaseAgent):
    """市场情绪分析Agent"""

    def __init__(self, weight: Decimal = Decimal("0.8")):
        super().__init__("情绪分析Agent", weight)

    async def analyze(
        self,
        code: str,
        current_price: float,
        indicator_data: Dict[str, Any],
        **kwargs
    ) -> Optional[AgentVote]:
        """
        基于市场情绪分析

        简化版：使用涨跌幅和成交量判断情绪
        """
        factors = {}
        reasons = []

        # 从 kwargs 获取额外数据
        change_pct = kwargs.get('change_pct', 0)
        volume_ratio = indicator_data.get('volume_ratio', 1)

        # 1. 涨跌幅分析
        if change_pct > 7:
            factors['price_momentum'] = 0.9
            reasons.append(f"强势上涨({change_pct:.1f}%)")
        elif change_pct > 3:
            factors['price_momentum'] = 0.7
            reasons.append(f"中度上涨({change_pct:.1f}%)")
        elif change_pct < -3:
            factors['price_momentum'] = 0.3
            reasons.append(f"下跌({change_pct:.1f}%)")
        else:
            factors['price_momentum'] = 0.5
            reasons.append("价格平稳")

        # 2. 量比分析（资金活跃度）
        if volume_ratio > 3:
            factors['volume_sentiment'] = 0.9
            reasons.append(f"成交量暴增({volume_ratio:.1f}倍)")
        elif volume_ratio > 1.5:
            factors['volume_sentiment'] = 0.7
            reasons.append(f"成交量放大({volume_ratio:.1f}倍)")
        elif volume_ratio < 0.5:
            factors['volume_sentiment'] = 0.3
            reasons.append("成交量萎缩")
        else:
            factors['volume_sentiment'] = 0.5

        # 3. 涨停潜力（核心）
        if change_pct > 7 and volume_ratio > 2:
            factors['limit_up_potential'] = 0.95
            reasons.append("🔥 涨停潜力高")
        elif change_pct > 5 and volume_ratio > 1.5:
            factors['limit_up_potential'] = 0.80
            reasons.append("有涨停潜力")

        # 计算综合得分
        confidence = self.calculate_confidence(factors)

        # 情绪Agent更倾向于追涨
        if confidence >= Decimal("0.65"):
            decision = "buy"
        elif confidence <= Decimal("0.35"):
            decision = "sell"
        else:
            decision = "hold"

        vote = AgentVote(
            agent_type="sentiment",
            decision=decision,
            score=confidence,
            reasoning="; ".join(reasons),
            weight=self.weight
        )

        self.log_decision(vote)
        return vote

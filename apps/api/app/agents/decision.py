"""
决策Agent
综合所有Agent的投票，做出最终决策
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.agents.base import BaseAgent, AgentVote
from app.db.session import get_db_session
from app.models.signal import Signal
from app.models.decision import AgentDecision
from app.core.config import settings
from loguru import logger


class DecisionAgent(BaseAgent):
    """
    决策Agent（裁决者）

    收集所有专家的投票，综合权重和置信度做出最终决策
    """

    def __init__(self):
        super().__init__("决策Agent", Decimal("1.0"))

    async def make_decision(
        self,
        code: str,
        current_price: float,
        votes: List[AgentVote],
        **kwargs
    ) -> Optional[Signal]:
        """
        综合所有Agent投票，生成最终信号

        Args:
            code: 股票代码
            current_price: 当前价格
            votes: 所有Agent的投票

        Returns:
            Signal 对象或 None
        """
        if not votes:
            logger.warning(f"{code} 没有Agent投票")
            return None

        # 1. 统计投票
        buy_score = Decimal("0")
        sell_score = Decimal("0")
        hold_score = Decimal("0")

        agent_votes_dict = {}

        for vote in votes:
            weighted_score = vote.score * vote.weight

            if vote.decision == "buy":
                buy_score += weighted_score
            elif vote.decision == "sell":
                sell_score += weighted_score
            else:
                hold_score += weighted_score

            agent_votes_dict[vote.agent_type] = {
                "decision": vote.decision,
                "score": float(vote.score),
                "weight": float(vote.weight),
                "reasoning": vote.reasoning,
            }

        # 2. 计算最终得分
        total_score = buy_score + sell_score + hold_score

        if total_score == 0:
            return None

        buy_ratio = buy_score / total_score
        sell_ratio = sell_score / total_score

        # 3. 决策逻辑
        final_decision = None
        final_confidence = Decimal("0")
        reasons = []

        if buy_ratio > Decimal("0.6"):
            final_decision = "buy"
            final_confidence = min(buy_ratio, Decimal("0.95"))
            reasons.append(f"{len([v for v in votes if v.decision == 'buy'])}个Agent建议买入")
        elif sell_ratio > Decimal("0.6"):
            final_decision = "sell"
            final_confidence = min(sell_ratio, Decimal("0.95"))
            reasons.append(f"{len([v for v in votes if v.decision == 'sell'])}个Agent建议卖出")
        else:
            # 意见分歧，需要详细分析
            if buy_score > sell_score:
                final_decision = "watch"
                final_confidence = Decimal("0.5")
                reasons.append("意见分歧，建议观望")
            else:
                return None  # 不生成信号

        # 4. 检查置信度阈值
        if final_confidence < Decimal(str(settings.SIGNAL_THRESHOLD)):
            logger.info(f"{code} 置信度{final_confidence:.2f}低于阈值，不生成信号")
            return None

        # 5. 创建信号
        signal = Signal(
            code=code,
            signal_type=final_decision,
            confidence=final_confidence,
            trigger_price=Decimal(str(current_price)),
            reason="; ".join(reasons),
            agents_votes=agent_votes_dict,
            metadata={
                "timestamp": datetime.now().isoformat(),
                "buy_score": float(buy_score),
                "sell_score": float(sell_score),
                "hold_score": float(hold_score),
            }
        )

        # 6. 保存到数据库
        async with get_db_session() as session:
            session.add(signal)
            await session.flush()  # 获取signal.id

            # 保存每个Agent的决策
            for vote in votes:
                decision = AgentDecision(
                    signal_id=signal.id,
                    agent_type=vote.agent_type,
                    decision=vote.decision,
                    score=vote.score,
                    reasoning=vote.reasoning,
                    weight=vote.weight,
                )
                session.add(decision)

        logger.info(
            f"🎯 决策完成: {code} - {final_decision} - "
            f"置信度: {final_confidence:.2f}"
        )

        return signal

    async def analyze(self, **kwargs) -> Optional[AgentVote]:
        """
        决策Agent不需要单独分析
        它通过 make_decision 方法工作
        """
        return None

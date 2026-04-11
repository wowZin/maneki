"""
Agent基类
所有Agent的抽象基类
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, Any, Optional

from loguru import logger


@dataclass
class AgentVote:
    """Agent投票结果"""
    agent_type: str
    decision: str  # buy/sell/hold
    score: Decimal  # 0-1
    reasoning: str
    weight: Decimal = Decimal("1.0")


class BaseAgent(ABC):
    """Agent基类"""

    def __init__(self, name: str, weight: Decimal = Decimal("1.0")):
        self.name = name
        self.weight = weight
        self.is_active = True

    @abstractmethod
    async def analyze(
        self,
        code: str,
        current_price: float,
        indicator_data: Dict[str, Any],
        **kwargs
    ) -> Optional[AgentVote]:
        """
        分析并返回投票结果

        Args:
            code: 股票代码
            current_price: 当前价格
            indicator_data: 技术指标数据

        Returns:
            AgentVote 对象或 None
        """
        pass

    def calculate_confidence(self, factors: Dict[str, float]) -> Decimal:
        """
        计算置信度

        Args:
            factors: 各因素得分 {factor: score}

        Returns:
            综合置信度 0-1
        """
        if not factors:
            return Decimal("0.5")

        avg_score = sum(factors.values()) / len(factors)
        return Decimal(str(min(max(avg_score, 0), 1)))

    def log_decision(self, vote: AgentVote):
        """记录决策日志"""
        logger.info(
            f"[{self.name}] 决策: {vote.decision}, "
            f"置信度: {vote.score}, 权重: {vote.weight}"
        )

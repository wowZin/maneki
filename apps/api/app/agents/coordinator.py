"""
多Agent协调器

负责协调多个Agent的执行，聚合决策结果
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime

from loguru import logger

from app.agents.base.agent import AgentInput, AgentOutput, AgentDecision, DecisionType
from app.agents.registry import registry


@dataclass
class MultiAgentResult:
    """
    多Agent决策结果

    Attributes:
        stock_code: 股票代码
        final_decision: 最终决策
        final_confidence: 最终置信度
        agent_results: 各Agent的原始结果
        aggregation_method: 聚合方法
        reasoning: 综合理由
    """
    stock_code: str
    final_decision: DecisionType
    final_confidence: float
    agent_results: Dict[str, AgentDecision]
    aggregation_method: str
    reasoning: str
    timestamp: datetime = field(default_factory=datetime.now)

    def get_agent_decision(self, agent_type: str) -> Optional[AgentDecision]:
        """获取特定Agent的决策"""
        return self.agent_results.get(agent_type)

    def get_bullish_agents(self) -> List[str]:
        """获取看涨的Agent列表"""
        return [
            agent_type for agent_type, decision in self.agent_results.items()
            if decision.decision in [DecisionType.BUY, DecisionType.STRONG_BUY]
        ]

    def get_bearish_agents(self) -> List[str]:
        """获取看跌的Agent列表"""
        return [
            agent_type for agent_type, decision in self.agent_results.items()
            if decision.decision in [DecisionType.SELL, DecisionType.STRONG_SELL]
        ]

    def get_average_confidence(self) -> float:
        """获取平均置信度"""
        if not self.agent_results:
            return 0.0
        return sum(d.confidence for d in self.agent_results.values()) / len(self.agent_results)


class MultiAgentCoordinator:
    """
    多Agent协调器

    管理多个Agent的执行和决策聚合
    """

    def __init__(
        self,
        llm_client=None,
        config: Optional[Dict] = None,
        agent_types: Optional[List[str]] = None
    ):
        """
        初始化协调器

        Args:
            llm_client: LLM客户端
            config: 配置
            agent_types: 要使用的Agent类型列表，None表示使用所有
        """
        self.llm_client = llm_client
        self.config = config or {}
        self.logger = logger.bind(component="MultiAgentCoordinator")

        # 获取Agent类型列表
        if agent_types is None:
            # 使用所有已注册的Agent
            self.agent_types = [a["type"] for a in registry.list_agents()]
        else:
            self.agent_types = agent_types

        self.logger.info(f"多Agent协调器初始化完成，将使用: {self.agent_types}")

    async def analyze(
        self,
        stock_codes: List[str],
        market_context: Optional[Dict] = None,
        parallel: bool = True
    ) -> Dict[str, MultiAgentResult]:
        """
        执行多Agent分析

        Args:
            stock_codes: 股票代码列表
            market_context: 市场环境信息
            parallel: 是否并行执行

        Returns:
            {股票代码: MultiAgentResult} 字典
        """
        self.logger.info(f"开始多Agent分析: {len(stock_codes)} 只股票, "
                        f"使用 {len(self.agent_types)} 个Agent")

        # 创建输入
        agent_input = AgentInput(
            stock_codes=stock_codes,
            market_context=market_context
        )

        # 执行所有Agent
        if parallel:
            agent_outputs = await self._run_agents_parallel(agent_input)
        else:
            agent_outputs = await self._run_agents_sequential(agent_input)

        # 聚合每个股票的决策
        results = {}
        for code in stock_codes:
            result = self._aggregate_decisions(code, agent_outputs)
            results[code] = result

        return results

    async def _run_agents_parallel(
        self,
        agent_input: AgentInput
    ) -> Dict[str, AgentOutput]:
        """并行执行所有Agent"""
        tasks = []
        agent_types = []

        for agent_type in self.agent_types:
            agent = registry.get(agent_type, self.llm_client, self.config)
            if agent:
                task = agent.run(agent_input)
                tasks.append(task)
                agent_types.append(agent_type)

        # 并行执行
        outputs = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果
        results = {}
        for agent_type, output in zip(agent_types, outputs):
            if isinstance(output, Exception):
                self.logger.error(f"Agent {agent_type} 执行失败: {output}")
                # 创建空结果
                output = AgentOutput(
                    agent_name=agent_type,
                    agent_type=agent_type,
                    request_id=agent_input.request_id,
                    timestamp=datetime.now(),
                    decisions=[],
                    metadata={"error": str(output)}
                )
            results[agent_type] = output

        return results

    async def _run_agents_sequential(
        self,
        agent_input: AgentInput
    ) -> Dict[str, AgentOutput]:
        """串行执行所有Agent"""
        results = {}

        for agent_type in self.agent_types:
            agent = registry.get(agent_type, self.llm_client, self.config)
            if agent:
                try:
                    output = await agent.run(agent_input)
                    results[agent_type] = output
                except Exception as e:
                    self.logger.error(f"Agent {agent_type} 执行失败: {e}")
                    results[agent_type] = AgentOutput(
                        agent_name=agent_type,
                        agent_type=agent_type,
                        request_id=agent_input.request_id,
                        timestamp=datetime.now(),
                        decisions=[],
                        metadata={"error": str(e)}
                    )

        return results

    def _aggregate_decisions(
        self,
        stock_code: str,
        agent_outputs: Dict[str, AgentOutput]
    ) -> MultiAgentResult:
        """
        聚合多个Agent对单只股票的决策

        使用加权投票法，不同Agent有不同权重
        """
        # 权重配置
        weights = self.config.get("agent_weights", {
            "sentiment": 0.25,
            "technical": 0.30,
            "capital": 0.30,
            "fundamental": 0.15,
        })

        # 收集各Agent的决策
        agent_decisions: Dict[str, AgentDecision] = {}
        for agent_type, output in agent_outputs.items():
            decision = output.get_decision_for_stock(stock_code)
            if decision:
                agent_decisions[agent_type] = decision

        # 计算加权分数
        decision_scores = {dec: 0.0 for dec in DecisionType}
        total_weight = 0.0

        for agent_type, decision in agent_decisions.items():
            weight = weights.get(agent_type, 0.25)
            # 决策映射到分数
            score = self._decision_to_score(decision.decision, decision.confidence)
            # 根据决策类型累加分数
            decision_scores[decision.decision] += weight * decision.confidence
            total_weight += weight

        # 选择得分最高的决策
        if total_weight > 0:
            best_decision = max(decision_scores, key=decision_scores.get)
            best_score = decision_scores[best_decision] / total_weight
        else:
            best_decision = DecisionType.ABSTAIN
            best_score = 0.0

        # 计算最终置信度
        final_confidence = self._calculate_final_confidence(
            agent_decisions, best_decision, weights
        )

        # 构建综合理由
        reasoning = self._build_aggregated_reasoning(stock_code, agent_decisions)

        return MultiAgentResult(
            stock_code=stock_code,
            final_decision=best_decision,
            final_confidence=final_confidence,
            agent_results=agent_decisions,
            aggregation_method="weighted_voting",
            reasoning=reasoning
        )

    def _decision_to_score(self, decision: DecisionType, confidence: float) -> float:
        """将决策映射到分数"""
        scores = {
            DecisionType.STRONG_BUY: 1.0,
            DecisionType.BUY: 0.6,
            DecisionType.HOLD: 0.0,
            DecisionType.SELL: -0.6,
            DecisionType.STRONG_SELL: -1.0,
            DecisionType.ABSTAIN: 0.0,
        }
        return scores.get(decision, 0.0) * confidence

    def _calculate_final_confidence(
        self,
        agent_decisions: Dict[str, AgentDecision],
        final_decision: DecisionType,
        weights: Dict[str, float]
    ) -> float:
        """计算最终置信度"""
        if not agent_decisions:
            return 0.0

        # 支持最终决策的Agent的加权置信度
        supporting_confidence = 0.0
        total_weight = 0.0

        for agent_type, decision in agent_decisions.items():
            weight = weights.get(agent_type, 0.25)
            total_weight += weight

            # 判断该Agent是否支持最终决策
            if self._is_supporting(decision.decision, final_decision):
                supporting_confidence += weight * decision.confidence

        if total_weight > 0:
            return supporting_confidence / total_weight
        return 0.0

    def _is_supporting(self, decision: DecisionType, target: DecisionType) -> bool:
        """判断decision是否支持target决策"""
        # 同向决策视为支持
        bullish = [DecisionType.STRONG_BUY, DecisionType.BUY]
        bearish = [DecisionType.STRONG_SELL, DecisionType.SELL]
        neutral = [DecisionType.HOLD, DecisionType.ABSTAIN]

        if target in bullish and decision in bullish:
            return True
        if target in bearish and decision in bearish:
            return True
        if target in neutral and decision in neutral:
            return True
        return False

    def _build_aggregated_reasoning(
        self,
        stock_code: str,
        agent_decisions: Dict[str, AgentDecision]
    ) -> str:
        """构建综合理由"""
        parts = [f"【{stock_code}综合分析】"]

        # 统计各方向
        bullish = []
        bearish = []
        neutral = []

        for agent_type, decision in agent_decisions.items():
            if decision.decision in [DecisionType.STRONG_BUY, DecisionType.BUY]:
                bullish.append(f"{agent_type}({decision.confidence:.0%})")
            elif decision.decision in [DecisionType.STRONG_SELL, DecisionType.SELL]:
                bearish.append(f"{agent_type}({decision.confidence:.0%})")
            else:
                neutral.append(f"{agent_type}({decision.confidence:.0%})")

        if bullish:
            parts.append(f"看涨: {', '.join(bullish)}")
        if bearish:
            parts.append(f"看跌: {', '.join(bearish)}")
        if neutral:
            parts.append(f"观望: {', '.join(neutral)}")

        # 添加各Agent的关键信号
        parts.append("\n关键信号:")
        for agent_type, decision in agent_decisions.items():
            if decision.signals:
                parts.append(f"  [{agent_type}] {', '.join(decision.signals[:2])}")

        return "\n".join(parts)

    def get_agent_info(self) -> List[Dict[str, Any]]:
        """获取所有Agent信息"""
        return registry.list_agents()


# 全局协调器实例
coordinator: Optional[MultiAgentCoordinator] = None


def get_coordinator(
    llm_client=None,
    config: Optional[Dict] = None,
    agent_types: Optional[List[str]] = None
) -> MultiAgentCoordinator:
    """获取全局协调器实例"""
    global coordinator
    if coordinator is None:
        coordinator = MultiAgentCoordinator(
            llm_client=llm_client,
            config=config,
            agent_types=agent_types
        )
    return coordinator

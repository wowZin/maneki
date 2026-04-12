"""
Agent 服务

集成多Agent到信号生成流程
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from loguru import logger

from app.agents.coordinator import MultiAgentCoordinator, get_coordinator, MultiAgentResult
from app.agents.base.agent import DecisionType


class AgentService:
    """
    Agent 服务

    封装多Agent分析，提供简洁的接口给上层调用
    """

    def __init__(self, llm_client=None, config: Optional[Dict] = None):
        """
        初始化Agent服务

        Args:
            llm_client: LLM客户端
            config: 配置
        """
        self.coordinator = get_coordinator(llm_client, config)
        self.logger = logger.bind(service="AgentService")

    async def analyze_stocks(
        self,
        stock_codes: List[str],
        market_context: Optional[Dict] = None
    ) -> Dict[str, MultiAgentResult]:
        """
        分析股票列表

        Args:
            stock_codes: 股票代码列表
            market_context: 市场环境信息

        Returns:
            分析结果字典
        """
        self.logger.info(f"开始分析 {len(stock_codes)} 只股票")

        results = await self.coordinator.analyze(
            stock_codes=stock_codes,
            market_context=market_context,
            parallel=True
        )

        # 统计结果
        bullish_count = sum(
            1 for r in results.values()
            if r.final_decision in [DecisionType.STRONG_BUY, DecisionType.BUY]
        )
        bearish_count = sum(
            1 for r in results.values()
            if r.final_decision in [DecisionType.STRONG_SELL, DecisionType.SELL]
        )

        self.logger.info(
            f"分析完成: 看涨 {bullish_count} 只, 看跌 {bearish_count} 只"
        )

        return results

    async def get_signals(
        self,
        stock_codes: List[str],
        market_context: Optional[Dict] = None,
        min_confidence: float = 0.6
    ) -> List[Dict[str, Any]]:
        """
        获取交易信号

        Args:
            stock_codes: 股票代码列表
            market_context: 市场环境信息
            min_confidence: 最小置信度阈值

        Returns:
            信号列表
        """
        results = await self.analyze_stocks(stock_codes, market_context)

        signals = []
        for code, result in results.items():
            # 只返回高置信度的看涨信号
            if (
                result.final_decision in [DecisionType.STRONG_BUY, DecisionType.BUY]
                and result.final_confidence >= min_confidence
            ):
                signal = self._convert_to_signal(result)
                signals.append(signal)

        # 按置信度排序
        signals.sort(key=lambda x: x["confidence"], reverse=True)

        return signals

    def _convert_to_signal(self, result: MultiAgentResult) -> Dict[str, Any]:
        """将MultiAgentResult转换为信号格式"""
        return {
            "stock_code": result.stock_code,
            "signal_type": result.final_decision.value,
            "confidence": result.final_confidence,
            "reasoning": result.reasoning,
            "agent_results": {
                agent_type: {
                    "decision": d.decision.value,
                    "confidence": d.confidence,
                    "signals": d.signals,
                    "risk_factors": d.risk_factors,
                }
                for agent_type, d in result.agent_results.items()
            },
            "bullish_agents": result.get_bullish_agents(),
            "bearish_agents": result.get_bearish_agents(),
            "timestamp": result.timestamp.isoformat(),
        }

    def get_agent_status(self) -> Dict[str, Any]:
        """获取Agent状态"""
        agents = self.coordinator.get_agent_info()

        return {
            "total_agents": len(agents),
            "agents": agents,
            "active_agent_types": self.coordinator.agent_types,
        }


# 全局服务实例
_agent_service: Optional[AgentService] = None


def get_agent_service(llm_client=None, config: Optional[Dict] = None) -> AgentService:
    """获取全局Agent服务实例"""
    global _agent_service
    if _agent_service is None:
        _agent_service = AgentService(llm_client, config)
    return _agent_service


async def analyze_with_agents(
    stock_codes: List[str],
    market_context: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    便捷函数：使用Agent分析股票

    Args:
        stock_codes: 股票代码列表
        market_context: 市场环境信息

    Returns:
        分析结果
    """
    service = get_agent_service()
    results = await service.analyze_stocks(stock_codes, market_context)

    # 转换为可序列化的格式
    return {
        code: {
            "stock_code": r.stock_code,
            "final_decision": r.final_decision.value,
            "final_confidence": r.final_confidence,
            "reasoning": r.reasoning,
            "bullish_agents": r.get_bullish_agents(),
            "bearish_agents": r.get_bearish_agents(),
            "agent_results": {
                agent_type: {
                    "decision": d.decision.value,
                    "confidence": d.confidence,
                    "signals": d.signals,
                    "risk_factors": d.risk_factors,
                }
                for agent_type, d in r.agent_results.items()
            },
        }
        for code, r in results.items()
    }

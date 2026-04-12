"""
Agent 基类定义

所有Agent必须继承此类，并实现以下核心方法：
- get_system_prompt(): 返回Agent特色的系统提示词
- gather_information(): 根据股票代码获取相关信息
- analyze(): 执行分析并返回决策结果
"""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, TypeVar, Generic
import uuid

from loguru import logger


class DecisionType(str, Enum):
    """决策类型枚举"""
    STRONG_BUY = "strong_buy"      # 强烈推荐买入（涨停概率>80%）
    BUY = "buy"                     # 推荐买入（涨停概率>60%）
    HOLD = "hold"                   # 观望（涨停概率40-60%）
    SELL = "sell"                   # 建议卖出（涨停概率<40%）
    STRONG_SELL = "strong_sell"     # 强烈建议卖出（涨停概率<20%）
    ABSTAIN = "abstain"             # 放弃（信息不足或不确定）


@dataclass
class AgentInput:
    """
    Agent输入数据

    Attributes:
        stock_codes: 股票代码列表
        market_context: 市场整体环境信息
        request_id: 请求唯一标识
        timestamp: 请求时间戳
        extra_params: 额外参数
    """
    stock_codes: List[str]
    market_context: Optional[Dict[str, Any]] = None
    request_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: datetime = field(default_factory=datetime.now)
    extra_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentDecision:
    """
    单个股票的决策结果

    Attributes:
        stock_code: 股票代码
        decision: 决策类型
        confidence: 置信度（0-1）
        reasoning: 决策理由
        signals: 关键信号列表
        risk_factors: 风险因素
        time_horizon: 时间周期（short/medium/long）
    """
    stock_code: str
    decision: DecisionType
    confidence: float = 0.0
    reasoning: str = ""
    signals: List[str] = field(default_factory=list)
    risk_factors: List[str] = field(default_factory=list)
    time_horizon: str = "short"  # short: 当日, medium: 3-5日, long: 更长

    def __post_init__(self):
        # 确保置信度在0-1之间
        self.confidence = max(0.0, min(1.0, self.confidence))


@dataclass
class AgentOutput:
    """
    Agent输出结果

    Attributes:
        agent_name: Agent名称
        agent_type: Agent类型标识
        request_id: 对应请求ID
        timestamp: 决策时间戳
        decisions: 股票决策结果列表
        metadata: 元数据（包含数据来源、处理时间等）
    """
    agent_name: str
    agent_type: str
    request_id: str
    timestamp: datetime
    decisions: List[AgentDecision]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_decision_for_stock(self, stock_code: str) -> Optional[AgentDecision]:
        """获取特定股票的决策"""
        for decision in self.decisions:
            if decision.stock_code == stock_code:
                return decision
        return None

    def get_bullish_stocks(self) -> List[str]:
        """获取看涨的股票列表"""
        return [
            d.stock_code for d in self.decisions
            if d.decision in [DecisionType.BUY, DecisionType.STRONG_BUY]
        ]

    def get_confidence_score(self) -> float:
        """获取平均置信度"""
        if not self.decisions:
            return 0.0
        return sum(d.confidence for d in self.decisions) / len(self.decisions)


class BaseAgent(ABC):
    """
    Agent 基类

    所有Agent必须继承此类，实现以下方法：
    - get_system_prompt(): 系统提示词
    - gather_information(): 信息收集
    - analyze(): 分析决策

    Attributes:
        name: Agent名称
        agent_type: Agent类型标识
        version: Agent版本
        description: Agent描述
    """

    # 类属性，子类应覆盖
    name: str = "BaseAgent"
    agent_type: str = "base"
    version: str = "1.0.0"
    description: str = "基础Agent"

    def __init__(self, llm_client=None, config: Optional[Dict] = None):
        """
        初始化Agent

        Args:
            llm_client: LLM客户端（OpenAI/Claude等）
            config: Agent配置
        """
        self.llm_client = llm_client
        self.config = config or {}
        self.logger = logger.bind(agent=self.name)

    @abstractmethod
    def get_system_prompt(self) -> str:
        """
        获取Agent特色的系统提示词

        Returns:
            系统提示词字符串，定义Agent的角色、能力和输出格式
        """
        pass

    @abstractmethod
    async def gather_information(self, stock_codes: List[str]) -> Dict[str, Any]:
        """
        根据Agent特色收集股票相关信息

        Args:
            stock_codes: 股票代码列表

        Returns:
            包含各股票相关信息的字典
        """
        pass

    @abstractmethod
    async def analyze(
        self,
        stock_codes: List[str],
        information: Dict[str, Any],
        market_context: Optional[Dict] = None
    ) -> List[AgentDecision]:
        """
        执行分析并返回决策结果

        Args:
            stock_codes: 股票代码列表
            information: gather_information()返回的信息
            market_context: 市场环境信息

        Returns:
            各股票的决策结果列表
        """
        pass

    async def run(self, input_data: AgentInput) -> AgentOutput:
        """
        执行Agent完整流程

        Args:
            input_data: AgentInput对象

        Returns:
            AgentOutput对象
        """
        self.logger.info(
            f"[{input_data.request_id}] {self.name} 开始分析 {len(input_data.stock_codes)} 只股票"
        )

        start_time = datetime.now()

        try:
            # 1. 收集信息
            self.logger.debug(f"[{input_data.request_id}] 收集信息中...")
            information = await self.gather_information(input_data.stock_codes)

            # 2. 执行分析
            self.logger.debug(f"[{input_data.request_id}] 分析中...")
            decisions = await self.analyze(
                stock_codes=input_data.stock_codes,
                information=information,
                market_context=input_data.market_context
            )

            # 3. 构建输出
            processing_time = (datetime.now() - start_time).total_seconds()

            output = AgentOutput(
                agent_name=self.name,
                agent_type=self.agent_type,
                request_id=input_data.request_id,
                timestamp=datetime.now(),
                decisions=decisions,
                metadata={
                    "processing_time_seconds": processing_time,
                    "stock_count": len(input_data.stock_codes),
                    "data_sources": list(information.keys()),
                    "version": self.version,
                }
            )

            self.logger.info(
                f"[{input_data.request_id}] {self.name} 分析完成，"
                f"处理时间: {processing_time:.2f}s, "
                f"看涨股票: {len(output.get_bullish_stocks())}"
            )

            return output

        except Exception as e:
            self.logger.error(f"[{input_data.request_id}] Agent执行失败: {e}")
            # 返回空决策结果
            return AgentOutput(
                agent_name=self.name,
                agent_type=self.agent_type,
                request_id=input_data.request_id,
                timestamp=datetime.now(),
                decisions=[
                    AgentDecision(
                        stock_code=code,
                        decision=DecisionType.ABSTAIN,
                        confidence=0.0,
                        reasoning=f"分析失败: {str(e)}"
                    )
                    for code in input_data.stock_codes
                ],
                metadata={
                    "error": str(e),
                    "processing_time_seconds": (datetime.now() - start_time).total_seconds(),
                }
            )

    def format_decisions_for_prompt(
        self,
        decisions: List[AgentDecision]
    ) -> str:
        """将决策结果格式化为字符串，用于LLM提示词"""
        lines = []
        for d in decisions:
            lines.append(f"股票: {d.stock_code}")
            lines.append(f"  决策: {d.decision.value}")
            lines.append(f"  置信度: {d.confidence:.2%}")
            lines.append(f"  理由: {d.reasoning}")
            if d.signals:
                lines.append(f"  信号: {', '.join(d.signals)}")
            lines.append("")
        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典表示"""
        return {
            "name": self.name,
            "type": self.agent_type,
            "version": self.version,
            "description": self.description,
        }

    def __repr__(self) -> str:
        return f"<{self.name}(type={self.agent_type}, version={self.version})>"

"""
多Agent决策系统

每个Agent有自己的特色系统提示词，根据上游提供的股票代码，
获取相关信息来辅助涨停判断。
"""

from app.agents.base.agent import BaseAgent, AgentDecision, AgentInput, AgentOutput
from app.agents.registry import AgentRegistry

# 导出具体Agent实现
from app.agents.specialized.sentiment_agent import SentimentAgent
from app.agents.specialized.technical_agent import TechnicalAgent
from app.agents.specialized.capital_agent import CapitalAgent
from app.agents.specialized.fundamental_agent import FundamentalAgent

__all__ = [
    # 基类
    "BaseAgent",
    "AgentDecision",
    "AgentInput",
    "AgentOutput",
    # 注册表
    "AgentRegistry",
    # 具体Agent
    "SentimentAgent",
    "TechnicalAgent",
    "CapitalAgent",
    "FundamentalAgent",
]

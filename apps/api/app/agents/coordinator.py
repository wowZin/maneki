"""
讨论协调器
协调多个Agent的讨论和决策流程
"""

import asyncio
from typing import List, Dict, Any, Optional
from decimal import Decimal

from loguru import logger

from app.agents.base import AgentVote
from app.agents.technical import TechnicalAnalysisAgent
from app.agents.sentiment import SentimentAgent
from app.agents.capital import CapitalAgent
from app.agents.decision import DecisionAgent
from app.models.signal import Signal


class DiscussionCoordinator:
    """
    讨论协调器

    负责：
    1. 管理所有Agent
    2. 触发各Agent并行分析
    3. 收集投票结果
    4. 调用决策Agent生成最终信号
    """

    def __init__(self):
        self.agents = {
            'technical': TechnicalAnalysisAgent(weight=Decimal("1.0")),
            'sentiment': SentimentAgent(weight=Decimal("0.8")),
            'capital': CapitalAgent(weight=Decimal("0.9")),
        }
        self.decision_agent = DecisionAgent()

    async def discuss_and_decide(
        self,
        code: str,
        current_price: float,
        indicator_data: Dict[str, Any],
        **kwargs
    ) -> Optional[Signal]:
        """
        组织讨论并做出决策

        Args:
            code: 股票代码
            current_price: 当前价格
            indicator_data: 技术指标数据

        Returns:
            Signal 对象或 None
        """
        logger.info(f"🤖 开始讨论: {code}")

        # 1. 并行触发所有Agent分析
        tasks = []
        for agent_type, agent in self.agents.items():
            task = asyncio.create_task(
                agent.analyze(code, current_price, indicator_data, **kwargs),
                name=agent_type
            )
            tasks.append(task)

        # 2. 等待所有Agent完成（带超时）
        votes: List[AgentVote] = []
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=5.0  # 5秒超时
            )

            for result in results:
                if isinstance(result, AgentVote):
                    votes.append(result)
                elif isinstance(result, Exception):
                    logger.error(f"Agent分析失败: {result}")

        except asyncio.TimeoutError:
            logger.warning("Agent讨论超时")
            # 使用已完成的投票
            for task in tasks:
                if task.done() and not task.exception():
                    result = task.result()
                    if isinstance(result, AgentVote):
                        votes.append(result)

        logger.info(f"📊 收到 {len(votes)} 个Agent投票")

        # 3. 决策Agent综合裁决
        if votes:
            signal = await self.decision_agent.make_decision(
                code=code,
                current_price=current_price,
                votes=votes,
                **kwargs
            )
            return signal

        return None

    async def analyze_batch(
        self,
        stock_data_list: List[Dict[str, Any]]
    ) -> List[Signal]:
        """
        批量分析多只股票

        Args:
            stock_data_list: [
                {
                    'code': '000001.SZ',
                    'price': 10.5,
                    'indicator_data': {...},
                    ...
                }
            ]

        Returns:
            Signal列表
        """
        signals = []

        # 使用信号量限制并发数
        semaphore = asyncio.Semaphore(10)  # 最多10个并发

        async def analyze_one(data: Dict[str, Any]) -> Optional[Signal]:
            async with semaphore:
                return await self.discuss_and_decide(
                    code=data['code'],
                    current_price=data['price'],
                    indicator_data=data.get('indicator_data', {}),
                    **{k: v for k, v in data.items() if k not in ['code', 'price', 'indicator_data']}
                )

        # 并行分析所有股票
        tasks = [analyze_one(data) for data in stock_data_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Signal):
                signals.append(result)
            elif isinstance(result, Exception):
                logger.error(f"批量分析失败: {result}")

        logger.info(f"🎯 批量分析完成: {len(signals)} 个信号")
        return signals


# 全局协调器实例
coordinator = DiscussionCoordinator()

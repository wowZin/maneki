"""
Agent 权重评分服务
实现多 Agent 权重管理、决策综合和动态调整
"""

import math
import random
from datetime import date, datetime
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_weight import AgentWeight, AgentWeightHistory
from app.models.decision import AgentDecision
from app.models.replay import ReplayResult, AgentLearning


@dataclass
class AgentVote:
    """Agent 投票数据"""
    agent_type: str
    decision: str  # buy/sell/hold
    score: float  # 原始评分 0-1
    reasoning: Optional[str] = None


@dataclass
class WeightedDecision:
    """加权决策结果"""
    decision: str  # buy/sell/hold
    confidence: float  # 置信度 0-1
    weighted_votes: Dict[str, float]  # 各选项加权票数
    agent_contributions: Dict[str, Dict]  # 各 Agent 贡献详情
    algorithm_version: str = "v1.0"


class AgentWeightService:
    """Agent 权重评分服务"""

    # 淘汰阈值
    ELIMINATION_THRESHOLD = 60
    # 初始分数
    INITIAL_SCORE = 100
    # 每日扣分
    DAILY_PENALTY = 1

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== 初始化方法 ==========

    async def initialize_agents(self, agent_configs: List[Dict]) -> List[AgentWeight]:
        """
        初始化 Agent 权重表

        Args:
            agent_configs: [{"agent_type": "trend", "agent_name": "趋势Agent", "description": "..."}]
        """
        agents = []

        for config in agent_configs:
            # 检查是否已存在
            result = await self.db.execute(
                select(AgentWeight).where(AgentWeight.agent_type == config["agent_type"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                # 如果已淘汰，重置状态
                if existing.is_eliminated:
                    existing.is_eliminated = False
                    existing.is_active = True
                    existing.current_score = self.INITIAL_SCORE
                    existing.consecutive_bottom_count = 0
                    existing.elimination_date = None
                    existing.elimination_reason = None
                agents.append(existing)
            else:
                # 创建新 Agent
                agent = AgentWeight(
                    agent_type=config["agent_type"],
                    agent_name=config.get("agent_name", config["agent_type"]),
                    description=config.get("description", ""),
                    current_score=self.INITIAL_SCORE,
                    initial_score=self.INITIAL_SCORE,
                    is_active=True,
                    is_eliminated=False,
                )
                self.db.add(agent)
                agents.append(agent)

        await self.db.commit()
        return agents

    async def get_active_agents(self) -> List[AgentWeight]:
        """获取所有活跃的 Agent"""
        result = await self.db.execute(
            select(AgentWeight)
            .where(AgentWeight.is_active == True, AgentWeight.is_eliminated == False)
            .order_by(desc(AgentWeight.current_score))
        )
        return result.scalars().all()

    async def get_agent_by_type(self, agent_type: str) -> Optional[AgentWeight]:
        """获取指定类型的 Agent"""
        result = await self.db.execute(
            select(AgentWeight).where(AgentWeight.agent_type == agent_type)
        )
        return result.scalar_one_or_none()

    # ========== 决策综合算法（核心） ==========

    async def calculate_weighted_decision(
        self,
        votes: List[AgentVote],
        temperature: float = 1.0,
        randomness: float = 0.1
    ) -> WeightedDecision:
        """
        计算加权决策结果

        算法说明：
        1. 获取各 Agent 当前权重分
        2. 使用 softmax 归一化权重（考虑 temperature）
        3. 计算各决策选项的加权得分
        4. 添加随机扰动（避免一言堂）
        5. 选择最终决策

        Args:
            votes: 各 Agent 的投票
            temperature: softmax 温度（越高分布越均匀）
            randomness: 随机扰动幅度（0-1，避免完全由高分 Agent 决定）
        """
        if not votes:
            raise ValueError("投票列表不能为空")

        # 获取各 Agent 的权重分
        agent_weights = {}
        for vote in votes:
            agent = await self.get_agent_by_type(vote.agent_type)
            if agent and agent.is_active and not agent.is_eliminated:
                agent_weights[vote.agent_type] = agent.current_score
            else:
                # Agent 不存在或已淘汰，使用默认分 50
                agent_weights[vote.agent_type] = 50

        # Softmax 归一化
        normalized_weights = self._softmax_normalize(
            agent_weights, temperature=temperature
        )

        # 计算各决策选项的加权得分
        decision_scores = {"buy": 0.0, "sell": 0.0, "hold": 0.0}
        agent_contributions = {}

        for vote in votes:
            weight = normalized_weights.get(vote.agent_type, 0)
            # 综合权重 = 归一化权重 * Agent 原始评分
            contribution = weight * vote.score
            decision_scores[vote.decision] += contribution

            agent_contributions[vote.agent_type] = {
                "original_score": vote.score,
                "current_weight_score": agent_weights[vote.agent_type],
                "normalized_weight": weight,
                "contribution": contribution,
                "decision": vote.decision,
                "reasoning": vote.reasoning,
            }

        # 添加随机扰动（避免一言堂）
        if randomness > 0:
            for decision in decision_scores:
                noise = random.uniform(-randomness, randomness) * 0.1
                decision_scores[decision] += noise

        # 选择最终决策
        final_decision = max(decision_scores, key=decision_scores.get)
        total_score = sum(decision_scores.values())
        confidence = decision_scores[final_decision] / total_score if total_score > 0 else 0

        return WeightedDecision(
            decision=final_decision,
            confidence=min(confidence, 1.0),
            weighted_votes=decision_scores,
            agent_contributions=agent_contributions,
            algorithm_version="v1.0_softmax_temp{}_rand{}".format(temperature, randomness)
        )

    def _softmax_normalize(
        self,
        weights: Dict[str, float],
        temperature: float = 1.0
    ) -> Dict[str, float]:
        """
        Softmax 归一化

        公式: w_i = exp(s_i / T) / sum(exp(s_j / T))

        Args:
            weights: 原始权重 {agent_type: score}
            temperature: 温度参数（T 越高，分布越均匀）
        """
        if not weights:
            return {}

        # 应用温度参数
        scores = [s / temperature for s in weights.values()]

        # 数值稳定性处理：减去最大值
        max_score = max(scores)
        exp_scores = [math.exp(s - max_score) for s in scores]

        # 计算 softmax
        sum_exp = sum(exp_scores)
        normalized = {k: exp_scores[i] / sum_exp for i, k in enumerate(weights.keys())}

        return normalized

    # ========== 每日复盘评分 ==========

    async def evaluate_daily_performance(
        self,
        evaluation_date: Optional[date] = None
    ) -> List[AgentWeightHistory]:
        """
        每日复盘评估

        流程：
        1. 统计各 Agent 当日表现
        2. 按成功率排名
        3. 排名末尾的 -1 分
        4. 检查淘汰条件
        5. 记录历史

        Returns:
            历史记录列表
        """
        eval_date = evaluation_date or date.today()

        # 获取所有活跃 Agent
        agents = await self.get_active_agents()
        if len(agents) < 2:
            return []  # Agent 太少，不进行评估

        # 统计各 Agent 当日表现
        performance_list = []
        for agent in agents:
            stats = await self._get_agent_daily_stats(agent.agent_type, eval_date)
            performance_list.append({
                "agent": agent,
                **stats
            })

        # 按成功率排序（成功率相同则按信号数）
        performance_list.sort(
            key=lambda x: (x["success_rate"] or 0, x["total_signals"]),
            reverse=True
        )

        # 记录排名并调整分数
        histories = []
        total_agents = len(performance_list)

        for rank, perf in enumerate(performance_list, 1):
            agent = perf["agent"]
            is_last = (rank == total_agents)

            # 计算新分数
            old_score = agent.current_score
            if is_last and perf["total_signals"] > 0:
                # 排名末尾且当日有信号，扣分
                new_score = max(0, old_score - self.DAILY_PENALTY)
                score_change = -self.DAILY_PENALTY
                adjustment_reason = f"当日排名末尾（{rank}/{total_agents}），成功率 {perf['success_rate']:.1f}%"

                # 更新连续垫底次数
                agent.consecutive_bottom_count += 1
            else:
                # 不是末尾或当日无信号，不扣分
                new_score = old_score
                score_change = 0
                adjustment_reason = f"当日排名 {rank}/{total_agents}，保持分数"
                agent.consecutive_bottom_count = 0

            # 检查淘汰条件
            is_elimination_warning = new_score < self.ELIMINATION_THRESHOLD

            if new_score < self.ELIMINATION_THRESHOLD and not agent.is_eliminated:
                # 触发淘汰
                await self._eliminate_agent(agent, f"分数降至 {new_score}，低于淘汰线 {self.ELIMINATION_THRESHOLD}")

            # 更新 Agent
            agent.current_score = new_score
            agent.total_signals += perf["total_signals"]
            agent.success_count += perf["success_count"]
            agent.failure_count += perf["failure_count"]
            if agent.total_signals > 0:
                agent.overall_success_rate = Decimal(agent.success_count / agent.total_signals * 100)
            agent.last_evaluation_date = eval_date
            agent.updated_at = datetime.utcnow()

            # 创建历史记录
            history = AgentWeightHistory(
                agent_weight_id=agent.id,
                evaluation_date=eval_date,
                daily_signals=perf["total_signals"],
                daily_success=perf["success_count"],
                daily_failure=perf["failure_count"],
                daily_success_rate=Decimal(perf["success_rate"]) if perf["success_rate"] else None,
                daily_rank=rank,
                total_agents=total_agents,
                score_before=old_score,
                score_after=new_score,
                score_change=score_change,
                adjustment_reason=adjustment_reason,
                is_elimination_warning=is_elimination_warning,
            )
            self.db.add(history)
            histories.append(history)

        await self.db.commit()
        return histories

    async def _get_agent_daily_stats(
        self,
        agent_type: str,
        eval_date: date
    ) -> Dict:
        """获取 Agent 当日统计"""
        # 查询当日的 AgentLearning 记录
        result = await self.db.execute(
            select(AgentLearning).where(
                AgentLearning.agent_type == agent_type,
                AgentLearning.trade_date == eval_date
            )
        )
        learning = result.scalar_one_or_none()

        if learning:
            return {
                "total_signals": learning.total_signals,
                "success_count": learning.success_count,
                "failure_count": learning.failure_count,
                "success_rate": float(learning.success_rate) if learning.success_rate else 0,
            }

        # 如果没有记录，查询原始数据
        result = await self.db.execute(
            select(
                func.count(AgentDecision.id).label("total"),
                func.sum(func.case((ReplayResult.success == True, 1), else_=0)).label("success"),
            )
            .join(ReplayResult, AgentDecision.signal_id == ReplayResult.signal_id)
            .where(
                AgentDecision.agent_type == agent_type,
                ReplayResult.trade_date == eval_date,
            )
        )
        row = result.one()

        total = row.total or 0
        success = row.success or 0
        failure = total - success
        success_rate = (success / total * 100) if total > 0 else 0

        return {
            "total_signals": total,
            "success_count": success,
            "failure_count": failure,
            "success_rate": success_rate,
        }

    # ========== 淘汰机制 ==========

    async def _eliminate_agent(self, agent: AgentWeight, reason: str):
        """淘汰 Agent"""
        agent.is_eliminated = True
        agent.is_active = False
        agent.elimination_date = datetime.utcnow()
        agent.elimination_reason = reason
        agent.current_score = 0

    async def revive_agent(self, agent_type: str, reset_score: int = 60) -> Optional[AgentWeight]:
        """
        复活已淘汰的 Agent（用于重新训练后上线）

        Args:
            agent_type: Agent 类型
            reset_score: 复活后的分数（默认 60）
        """
        agent = await self.get_agent_by_type(agent_type)
        if not agent or not agent.is_eliminated:
            return None

        agent.is_eliminated = False
        agent.is_active = True
        agent.current_score = reset_score
        agent.consecutive_bottom_count = 0
        agent.elimination_date = None
        agent.elimination_reason = None
        agent.total_signals = 0
        agent.success_count = 0
        agent.failure_count = 0
        agent.overall_success_rate = None

        await self.db.commit()
        return agent

    # ========== 查询方法 ==========

    async def get_rankings(self, limit: int = 10) -> List[Dict]:
        """获取当前排名"""
        agents = await self.get_active_agents()

        rankings = []
        for i, agent in enumerate(agents, 1):
            rankings.append({
                "rank": i,
                "agent_type": agent.agent_type,
                "agent_name": agent.agent_name,
                "current_score": agent.current_score,
                "total_signals": agent.total_signals,
                "success_rate": float(agent.overall_success_rate) if agent.overall_success_rate else 0,
                "status": agent.status,
                "is_elimination_candidate": agent.is_elimination_candidate,
            })

        return rankings[:limit]

    async def get_agent_history(
        self,
        agent_type: str,
        days: int = 30
    ) -> List[Dict]:
        """获取 Agent 历史表现"""
        agent = await self.get_agent_by_type(agent_type)
        if not agent:
            return []

        result = await self.db.execute(
            select(AgentWeightHistory)
            .where(AgentWeightHistory.agent_weight_id == agent.id)
            .order_by(desc(AgentWeightHistory.evaluation_date))
            .limit(days)
        )
        histories = result.scalars().all()

        return [{
            "date": h.evaluation_date.isoformat(),
            "rank": h.daily_rank,
            "total_agents": h.total_agents,
            "score": h.score_after,
            "score_change": h.score_change,
            "signals": h.daily_signals,
            "success_rate": float(h.daily_success_rate) if h.daily_success_rate else None,
            "reason": h.adjustment_reason,
        } for h in histories]


# 便捷函数
def get_agent_weight_service(db: AsyncSession) -> AgentWeightService:
    """获取 AgentWeightService 实例"""
    return AgentWeightService(db)

"""
Agent 权重评分相关 Schema
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict

from pydantic import BaseModel, Field


class AgentWeightCreate(BaseModel):
    """创建 Agent 权重"""
    agent_type: str = Field(..., description="Agent类型标识")
    agent_name: str = Field(..., description="Agent显示名称")
    description: Optional[str] = Field(None, description="Agent描述")


class AgentWeightResponse(BaseModel):
    """Agent 权重响应"""
    id: int
    agent_type: str
    agent_name: str
    description: Optional[str] = None
    current_score: int
    initial_score: int
    is_active: bool
    is_eliminated: bool
    elimination_date: Optional[datetime] = None
    elimination_reason: Optional[str] = None
    total_signals: int
    success_count: int
    failure_count: int
    overall_success_rate: Optional[Decimal] = None
    consecutive_bottom_count: int
    created_at: datetime
    updated_at: datetime
    last_evaluation_date: Optional[date] = None

    class Config:
        from_attributes = True


class AgentWeightRanking(BaseModel):
    """Agent 排名"""
    rank: int
    agent_type: str
    agent_name: str
    current_score: int
    total_signals: int
    success_rate: float
    status: str
    is_elimination_candidate: bool


class AgentWeightHistoryResponse(BaseModel):
    """Agent 历史记录响应"""
    date: str
    rank: int
    total_agents: int
    score: int
    score_change: int
    signals: int
    success_rate: Optional[float] = None
    reason: str


class VoteItem(BaseModel):
    """投票项"""
    agent_type: str = Field(..., description="Agent类型")
    decision: str = Field(..., description="决策: buy/sell/hold")
    score: float = Field(..., ge=0, le=1, description="评分 0-1")
    reasoning: Optional[str] = Field(None, description="决策理由")


class WeightedDecisionRequest(BaseModel):
    """加权决策请求"""
    votes: List[VoteItem] = Field(..., description="各Agent投票")
    temperature: float = Field(1.0, ge=0.1, le=5.0, description="Softmax温度（越高分布越均匀）")
    randomness: float = Field(0.1, ge=0, le=1.0, description="随机扰动幅度（避免一言堂）")


class AgentContribution(BaseModel):
    """Agent贡献详情"""
    original_score: float
    current_weight_score: int
    normalized_weight: float
    contribution: float
    decision: str
    reasoning: Optional[str] = None


class WeightedDecisionResponse(BaseModel):
    """加权决策响应"""
    decision: str = Field(..., description="最终决策")
    confidence: float = Field(..., ge=0, le=1, description="置信度")
    weighted_votes: Dict[str, float] = Field(..., description="各选项加权票数")
    agent_contributions: Dict[str, AgentContribution] = Field(..., description="各Agent贡献")
    algorithm_version: str = Field(..., description="算法版本")


class DailyEvaluationRequest(BaseModel):
    """每日复盘评估请求"""
    evaluation_date: Optional[date] = Field(None, description="评估日期，默认今天")


class DailyEvaluationDetail(BaseModel):
    """每日评估详情"""
    agent_type: str
    agent_name: str
    daily_rank: int
    daily_signals: int
    daily_success_rate: Optional[Decimal] = None
    score_before: int
    score_after: int
    score_change: int
    adjustment_reason: str
    is_elimination_warning: bool


class DailyEvaluationResponse(BaseModel):
    """每日复盘评估响应"""
    evaluation_date: date
    total_agents_evaluated: int
    agents_penalized: int
    elimination_warnings: int
    details: List[DailyEvaluationDetail]


class AgentInitializeRequest(BaseModel):
    """初始化 Agent 请求"""
    agents: List[AgentWeightCreate] = Field(..., description="Agent配置列表")


class AgentStatsOverview(BaseModel):
    """Agent 统计概览"""
    total_agents: int
    active_agents: int
    eliminated_agents: int
    at_risk_agents: int
    average_score: float
    elimination_threshold: int = 60

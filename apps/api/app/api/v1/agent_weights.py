"""
Agent 权重评分管理 API
提供 Agent 权重查询、排名、复盘等功能
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user, current_superuser
from app.db.session import get_db_session
from app.models.user import User
from app.services.agent_weight_service import AgentWeightService, get_agent_weight_service
from app.schemas.agent_weight import (
    AgentWeightCreate,
    AgentWeightResponse,
    AgentWeightRanking,
    AgentWeightHistoryResponse,
    DailyEvaluationRequest,
    DailyEvaluationResponse,
    WeightedDecisionRequest,
    WeightedDecisionResponse,
    AgentInitializeRequest,
)

router = APIRouter()


# ========== Agent 初始化与管理 ==========

@router.post("/initialize", response_model=List[AgentWeightResponse])
async def initialize_agents(
    request: AgentInitializeRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """
    初始化 Agent 权重表（管理员）

    用于系统首次部署或添加新 Agent 类型
    """
    service = get_agent_weight_service(db)
    agents = await service.initialize_agents(request.agents)
    return agents


@router.get("/list", response_model=List[AgentWeightResponse])
async def list_agents(
    include_eliminated: bool = False,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取所有 Agent 列表"""
    service = get_agent_weight_service(db)

    if include_eliminated:
        # 获取所有 Agent
        from app.models.agent_weight import AgentWeight
        from sqlalchemy import select
        result = await db.execute(select(AgentWeight))
        agents = result.scalars().all()
    else:
        agents = await service.get_active_agents()

    return agents


@router.post("/{agent_type}/revive", response_model=AgentWeightResponse)
async def revive_agent(
    agent_type: str,
    reset_score: int = 60,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """
    复活已淘汰的 Agent（管理员）

    用于重新训练后恢复 Agent
    """
    service = get_agent_weight_service(db)
    agent = await service.revive_agent(agent_type, reset_score)

    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在或未被淘汰")

    return agent


# ========== 排名与查询 ==========

@router.get("/rankings", response_model=List[AgentWeightRanking])
async def get_rankings(
    limit: int = 10,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取当前 Agent 排名"""
    service = get_agent_weight_service(db)
    rankings = await service.get_rankings(limit)
    return rankings


@router.get("/{agent_type}/history", response_model=List[AgentWeightHistoryResponse])
async def get_agent_history(
    agent_type: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取指定 Agent 的历史表现"""
    service = get_agent_weight_service(db)
    history = await service.get_agent_history(agent_type, days)

    if not history:
        raise HTTPException(status_code=404, detail="Agent 不存在或无历史记录")

    return history


@router.get("/{agent_type}/detail", response_model=AgentWeightResponse)
async def get_agent_detail(
    agent_type: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取 Agent 详细信息"""
    service = get_agent_weight_service(db)
    agent = await service.get_agent_by_type(agent_type)

    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")

    return agent


# ========== 复盘评估 ==========

@router.post("/evaluate", response_model=DailyEvaluationResponse)
async def run_daily_evaluation(
    request: Optional[DailyEvaluationRequest] = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """
    执行每日复盘评估（管理员）

    统计各 Agent 当日表现，排名，末尾扣分，检查淘汰
    """
    service = get_agent_weight_service(db)
    eval_date = request.evaluation_date if request else None

    histories = await service.evaluate_daily_performance(eval_date)

    return {
        "evaluation_date": eval_date or date.today(),
        "total_agents_evaluated": len(histories),
        "agents_penalized": len([h for h in histories if h.score_change < 0]),
        "elimination_warnings": len([h for h in histories if h.is_elimination_warning]),
        "details": histories,
    }


# ========== 决策综合 ==========

@router.post("/decision", response_model=WeightedDecisionResponse)
async def calculate_weighted_decision(
    request: WeightedDecisionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """
    计算加权决策结果

    根据各 Agent 的投票和当前权重，综合计算最终决策
    """
    from app.services.agent_weight_service import AgentVote

    service = get_agent_weight_service(db)

    # 转换请求为 AgentVote
    votes = [
        AgentVote(
            agent_type=v.agent_type,
            decision=v.decision,
            score=v.score,
            reasoning=v.reasoning,
        )
        for v in request.votes
    ]

    # 计算加权决策
    result = await service.calculate_weighted_decision(
        votes=votes,
        temperature=request.temperature,
        randomness=request.randomness,
    )

    return {
        "decision": result.decision,
        "confidence": result.confidence,
        "weighted_votes": result.weighted_votes,
        "agent_contributions": result.agent_contributions,
        "algorithm_version": result.algorithm_version,
    }


# ========== 统计信息 ==========

@router.get("/stats/overview")
async def get_stats_overview(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取 Agent 权重系统统计概览"""
    from app.models.agent_weight import AgentWeight
    from sqlalchemy import select, func

    # 统计各状态 Agent 数量
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(func.case((AgentWeight.is_active == True, 1), else_=0)).label("active"),
            func.sum(func.case((AgentWeight.is_eliminated == True, 1), else_=0)).label("eliminated"),
            func.sum(func.case((AgentWeight.current_score < 60, 1), else_=0)).label("at_risk"),
        )
    )
    stats = result.one()

    # 平均分
    avg_result = await db.execute(
        select(func.avg(AgentWeight.current_score)).where(AgentWeight.is_eliminated == False)
    )
    avg_score = avg_result.scalar() or 0

    return {
        "total_agents": stats.total,
        "active_agents": stats.active,
        "eliminated_agents": stats.eliminated,
        "at_risk_agents": stats.at_risk,
        "average_score": round(float(avg_score), 2),
        "elimination_threshold": 60,
    }

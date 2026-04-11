"""
Agent 市场和用户自定义 Agent API
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user, current_superuser
from app.core.vip import current_vip_user, check_vip_feature, VIPFeature
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.agent_market import (
    AgentTemplateCreate,
    AgentTemplateResponse,
    AgentTemplateListItem,
    AgentTemplateFilter,
    UserAgentCreate,
    UserAgentUpdate,
    UserAgentResponse,
    UserAgentListItem,
    UserAgentWeightUpdate,
    UserAgentCloneRequest,
    WeightedDecisionRequest,
    WeightedDecisionResponse,
    AgentMarketReviewCreate,
    AgentMarketReviewResponse,
    InitializeUserAgentsRequest,
    UserAgentStats,
    SupportedModels,
)
from app.services.agent_market_service import (
    get_user_agent_service,
    get_agent_market_service,
    UserAgentService,
    AgentMarketService,
)

router = APIRouter()

# ========== Agent 市场 (Marketplace) ==========

@router.post("/market/templates", response_model=AgentTemplateResponse)
async def create_template(
    request: AgentTemplateCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """创建 Agent 模板并发布到市场（SVIP功能）"""
    if not check_vip_feature(current_user, VIPFeature.MARKET_PUBLISH):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "发布模板需要SVIP权限",
                "code": "SVIP_REQUIRED",
                "feature": VIPFeature.MARKET_PUBLISH
            }
        )
    service = get_agent_market_service(db)
    template = await service.create_template(
        creator_id=current_user.id,
        name=request.name,
        description=request.description,
        category=request.category,
        tags=request.tags,
        is_public=request.is_public,
        is_featured=request.is_featured,
        data_sources=[ds.model_dump() for ds in request.data_sources],
        prompt=request.prompt.model_dump(),
        llm_config=request.llm_config.model_dump(),
        reasoning_config=request.reasoning_config,
    )
    return template

@router.get("/market/templates", response_model=List[AgentTemplateListItem])
async def list_templates(
    category: Optional[str] = None,
    search: Optional[str] = None,
    featured_only: bool = Query(False, description="只显示精选模板(免费用户可用)"),
    sort_by: str = Query("rating", description="排序字段"),
    sort_order: str = Query("desc", description="asc/desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取市场模板列表

    - featured_only=true: 只返回精选模板（免费用户可用）
    - featured_only=false: 返回所有公开模板（需要SVIP权限才能克隆非精选模板）
    """
    service = get_agent_market_service(db)
    templates, total = await service.list_templates(
        user_id=current_user.id,
        category=category,
        search=search,
        featured_only=featured_only,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    # TODO: 添加 is_favorited 和 is_cloned 标记
    return templates

@router.get("/market/templates/featured", response_model=List[AgentTemplateListItem])
async def list_featured_templates(
    category: Optional[str] = None,
    sort_by: str = Query("rating", description="排序字段"),
    sort_order: str = Query("desc", description="asc/desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取精选模板列表（免费用户可用）"""
    service = get_agent_market_service(db)
    templates, total = await service.list_templates(
        user_id=current_user.id,
        category=category,
        search=None,
        featured_only=True,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return templates

@router.get("/market/templates/rankings")
async def get_template_rankings(
    sort_by: str = Query("composite", description="排序: composite/hot/rating/usage"),
    category: Optional[str] = None,
    featured_only: bool = Query(False, description="只显示精选模板"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """
    获取排名后的模板列表

    - composite: 综合排名（基于评分、使用次数、最近活动等）
    - hot: 热度排名（最近7天活动）
    - rating: 平均评分排名
    - usage: 使用次数排名
    """
    service = get_agent_market_service(db)
    templates, total = await service.get_ranked_templates(
        user_id=current_user.id,
        sort_by=sort_by,
        category=category,
        featured_only=featured_only,
        page=page,
        page_size=page_size,
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "sort_by": sort_by,
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "category": t.category,
                "is_featured": t.is_featured,
                "is_public": t.is_public,
                "rating": float(t.rating),
                "rating_count": t.rating_count,
                "usage_count": t.usage_count,
                "created_at": t.created_at,
            }
            for t in templates
        ],
    }

@router.get("/market/templates/{template_id}/stats")
async def get_template_stats(
    template_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取模板的评分统计"""
    from app.models.agent_market import AgentTemplateRatingStats

    result = await db.execute(
        select(AgentTemplateRatingStats).where(
            AgentTemplateRatingStats.template_id == template_id
        )
    )
    stats = result.scalar_one_or_none()

    if not stats:
        raise HTTPException(status_code=404, detail="暂无评分统计")

    return {
        "template_id": stats.template_id,
        "avg_rating": float(stats.avg_rating),
        "rating_count": stats.rating_count,
        "rating_distribution": stats.rating_distribution,
        "avg_accuracy": float(stats.avg_accuracy) if stats.avg_accuracy else None,
        "avg_speed": float(stats.avg_speed) if stats.avg_speed else None,
        "avg_usability": float(stats.avg_usability) if stats.avg_usability else None,
        "composite_score": float(stats.composite_score),
        "hot_score": float(stats.hot_score),
        "calculated_at": stats.calculated_at,
    }

# ========== Agent Owner 返佣管理 ==========

@router.get("/owner/rebates")
async def get_my_rebates(
    status: Optional[str] = Query(None, description="状态: pending/settled/refunded"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取我的返佣记录"""
    from app.services.agent_market_service import get_agent_rebate_service

    service = get_agent_rebate_service(db)
    rebates, total = await service.get_owner_rebates(
        owner_id=current_user.id,
        status=status,
        page=page,
        page_size=page_size,
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "rebates": [
            {
                "id": r.id,
                "subscription_id": r.subscription_id,
                "rebate_amount": float(r.rebate_amount),
                "subscription_amount": float(r.subscription_amount),
                "subscription_days": r.subscription_days,
                "status": r.status,
                "settlement_at": r.settlement_at,
                "settled_at": r.settled_at,
                "created_at": r.created_at,
            }
            for r in rebates
        ],
    }

@router.get("/owner/stats")
async def get_my_owner_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取我的 Agent Owner 收益统计"""
    from app.services.agent_market_service import get_agent_rebate_service
    from app.core.config import settings

    service = get_agent_rebate_service(db)
    stats = await service.get_owner_stats(current_user.id)

    # 添加返佣配置信息
    stats["rebate_config"] = {
        "enabled": settings.AGENT_SUBSCRIPTION_REBATE_ENABLED,
        "amount": settings.AGENT_SUBSCRIPTION_REBATE_AMOUNT,
        "min_vip_days": settings.AGENT_SUBSCRIPTION_REBATE_MIN_VIP_DAYS,
        "settlement_days": settings.AGENT_SUBSCRIPTION_REBATE_SETTLEMENT_DAYS,
    }

    return stats

@router.post("/owner/templates/{template_id}/set-featured")
async def set_template_featured(
    template_id: UUID,
    is_featured: bool = Query(..., description="是否设为精选"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """
    设置模板是否为精选（仅管理员或模板创建者）

    精选模板对所有用户开放（包括免费用户），可获得更多曝光
    """
    from app.core.vip import VIPLevel

    service = get_agent_market_service(db)
    template = await service.get_template(template_id)

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 检查权限：创建者或超级用户
    if template.creator_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="无权操作此模板")

    # 只有超级用户才能设为精选
    if is_featured and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="设为精选需要管理员权限")

    template.is_featured = is_featured
    await db.commit()

    return {
        "success": True,
        "template_id": template_id,
        "is_featured": is_featured,
    }

@router.get("/market/templates/{template_id}", response_model=AgentTemplateResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取模板详情"""
    service = get_agent_market_service(db)
    template = await service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    if not template.is_public and template.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看该模板")
    return template

@router.post("/market/templates/{template_id}/clone", response_model=UserAgentResponse)
async def clone_template(
    template_id: UUID,
    request: UserAgentCloneRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """从市场模板克隆 Agent 到用户库

    权限规则：
    - 精选模板(is_featured=True)：所有用户可用（包括免费用户）
    - 普通公开模板：需要SVIP权限才能克隆
    - 自己的模板：始终可用
    """
    service = get_user_agent_service(db)

    # 先获取模板检查权限
    market_service = get_agent_market_service(db)
    template = await market_service.get_template(template_id)

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 检查是否有权限使用该模板
    from app.core.vip import can_use_template
    if not can_use_template(current_user, template):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "克隆普通模板需要SVIP权限，免费用户只能使用精选模板",
                "code": "SVIP_REQUIRED",
                "feature": VIPFeature.MARKET_CLONE,
                "is_featured": template.is_featured,
            }
        )

    agent = await service.clone_from_template(
        user_id=current_user.id,
        template_id=template_id,
        user_vip_level=current_user.vip_level,
        custom_name=request.name,
        custom_llm_config=request.llm_config.model_dump() if request.llm_config else None,
        customizations=request.customizations,
    )
    return agent

@router.post("/market/templates/{template_id}/reviews", response_model=AgentMarketReviewResponse)
async def add_template_review(
    template_id: UUID,
    request: AgentMarketReviewCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """对模板进行评价"""
    service = get_agent_market_service(db)
    review = await service.add_review(
        template_id=template_id,
        user_id=current_user.id,
        rating=request.rating,
        comment=request.comment,
        accuracy_rating=request.accuracy_rating,
        speed_rating=request.speed_rating,
        usability_rating=request.usability_rating,
        tags=request.tags,
    )

    # 重新计算评分统计
    await service.calculate_template_rating_stats(template_id)

    # 构造响应
    return {
        "id": review.id,
        "template_id": review.template_id,
        "user_id": review.user_id,
        "username": current_user.username or current_user.display_name,
        "rating": review.rating,
        "comment": review.comment,
        "accuracy_rating": review.accuracy_rating,
        "speed_rating": review.speed_rating,
        "usability_rating": review.usability_rating,
        "tags": review.tags,
        "helpful_count": review.helpful_count,
        "created_at": review.created_at,
    }

# ========== 用户 Agent 管理 ==========

@router.post("/initialize", response_model=List[UserAgentResponse])
async def initialize_default_agents(
    request: InitializeUserAgentsRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """初始化用户默认 Agent 套装"""
    service = get_user_agent_service(db)
    agents = await service.initialize_default_agents(
        user_id=current_user.id,
        llm_config=None,  # 使用默认配置
    )
    return agents

@router.post("/my-agents", response_model=UserAgentResponse)
async def create_agent(
    request: UserAgentCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """创建自定义 Agent（SVIP功能）"""
    if not check_vip_feature(current_user, VIPFeature.CUSTOM_AGENT):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "创建自定义Agent需要SVIP权限",
                "code": "SVIP_REQUIRED",
                "feature": VIPFeature.CUSTOM_AGENT
            }
        )
    service = get_user_agent_service(db)
    try:
        agent = await service.create_agent(
            user_id=current_user.id,
            name=request.name,
            description=request.description,
            category=request.category,
            data_sources=[ds.model_dump() for ds in request.data_sources],
            prompt=request.prompt.model_dump(),
            llm_config=request.llm_config.model_dump(),
            manual_weight_score=request.manual_weight_score,
            use_manual_weight=request.use_manual_weight,
            icon=request.icon,
            color=request.color,
        )
        return agent
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/my-agents", response_model=List[UserAgentListItem])
async def list_my_agents(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取我的 Agent 列表"""
    service = get_user_agent_service(db)
    agents = await service.list_agents(
        user_id=current_user.id,
        category=category,
        is_active=is_active,
        is_favorite=is_favorite,
        search=search,
    )
    return agents

@router.get("/my-agents/{agent_id}", response_model=UserAgentResponse)
async def get_my_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取 Agent 详情"""
    service = get_user_agent_service(db)
    agent = await service.get_agent(agent_id, current_user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    return agent

@router.put("/my-agents/{agent_id}", response_model=UserAgentResponse)
async def update_agent(
    agent_id: UUID,
    request: UserAgentUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """更新 Agent"""
    service = get_user_agent_service(db)
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    try:
        agent = await service.update_agent(agent_id, current_user.id, updates)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent 不存在")
        return agent
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/my-agents/{agent_id}")
async def delete_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """删除 Agent（SVIP功能）"""
    if not check_vip_feature(current_user, VIPFeature.DELETE_AGENT):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "删除Agent需要SVIP权限",
                "code": "SVIP_REQUIRED",
                "feature": VIPFeature.DELETE_AGENT
            }
        )
    service = get_user_agent_service(db)
    success = await service.delete_agent(agent_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    return {"success": True, "message": "Agent 已删除"}

@router.patch("/my-agents/{agent_id}/weight", response_model=UserAgentResponse)
async def update_agent_weight(
    agent_id: UUID,
    request: UserAgentWeightUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """更新 Agent 权重分"""
    service = get_user_agent_service(db)
    agent = await service.update_weight(
        agent_id=agent_id,
        user_id=current_user.id,
        manual_weight_score=request.manual_weight_score,
        use_manual_weight=request.use_manual_weight,
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    return agent

# ========== 决策引擎 ==========

@router.post("/decision", response_model=WeightedDecisionResponse)
async def make_weighted_decision(
    request: WeightedDecisionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """
    执行多 Agent 加权决策

    按用户隔离，只使用当前用户配置的 Agent
    """
    service = get_user_agent_service(db)
    result = await service.calculate_weighted_decision(
        user_id=current_user.id,
        stock_code=request.stock_code,
        agent_ids=request.agent_ids,
        temperature=request.temperature,
        randomness=request.randomness,
        min_confidence=request.min_confidence,
        input_data=request.input_data,
    )
    return result

# ========== 复盘与统计 ==========

@router.post("/evaluate")
async def run_daily_evaluation(
    evaluation_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """执行每日复盘评估（VIP功能）"""
    if not check_vip_feature(current_user, VIPFeature.WEIGHT_EVALUATION):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "复盘评估需要VIP权限",
                "code": "VIP_REQUIRED",
                "feature": VIPFeature.WEIGHT_EVALUATION
            }
        )
    service = get_user_agent_service(db)
    histories = await service.evaluate_daily_performance(
        user_id=current_user.id,
        evaluation_date=evaluation_date,
    )
    return {
        "evaluation_date": evaluation_date or date.today(),
        "evaluated_count": len(histories),
        "details": histories,
    }

@router.get("/stats", response_model=UserAgentStats)
async def get_user_agent_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取用户 Agent 统计"""
    service = get_user_agent_service(db)
    stats = await service.get_user_stats(current_user.id)
    # 添加VIP信息
    stats["is_vip"] = current_user.is_vip
    stats["vip_level"] = current_user.vip_level
    stats["vip_expire_at"] = current_user.vip_expire_at.isoformat() if current_user.vip_expire_at else None
    return stats

@router.get("/my-agents/{agent_id}/history")
async def get_agent_history(
    agent_id: UUID,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_active_user),
):
    """获取 Agent 历史表现（VIP功能）"""
    if not check_vip_feature(current_user, VIPFeature.REPLAY):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "查看历史表现需要VIP权限",
                "code": "VIP_REQUIRED",
                "feature": VIPFeature.REPLAY
            }
        )
    from app.models.agent_market import UserAgentHistory
    from sqlalchemy import select, desc

    result = await db.execute(
        select(UserAgentHistory)
        .where(
            UserAgentHistory.agent_id == agent_id,
            UserAgentHistory.user_id == current_user.id
        )
        .order_by(desc(UserAgentHistory.evaluation_date))
        .limit(days)
    )
    histories = result.scalars().all()

    return [
        {
            "date": h.evaluation_date.isoformat(),
            "rank": h.daily_rank,
            "total_active_agents": h.total_active_agents,
            "daily_signals": h.daily_signals,
            "daily_success_rate": float(h.daily_success_rate) if h.daily_success_rate else None,
            "score_before": h.score_before,
            "score_after": h.score_after,
            "score_change": h.score_change,
            "adjustment_reason": h.adjustment_reason,
        }
        for h in histories
    ]

@router.get("/supported-models")
async def get_supported_models(
    current_user: User = Depends(current_active_user),
):
    """获取支持的模型列表（用于下拉选择）"""
    return {
        "providers": [
            {
                "id": "openai",
                "name": "OpenAI",
                "models": SupportedModels.OPENAI,
            },
            {
                "id": "anthropic",
                "name": "Anthropic",
                "models": SupportedModels.ANTHROPIC,
            },
            {
                "id": "deepseek",
                "name": "DeepSeek",
                "models": SupportedModels.DEEPSEEK,
            },
            {
                "id": "custom",
                "name": "自定义",
                "models": [],
                "description": "支持任意 OpenAI 兼容的 API"
            },
        ],
        "all_models": SupportedModels.get_all_models(),
    }

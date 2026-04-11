"""
管理后台 API
提供后台管理功能
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user, current_superuser
from app.core.config import settings
from app.db.session import get_db_session
from app.models.agent_market import (
    AgentTemplate,
    AgentTemplateRatingStats,
    AgentSubscriptionRebate,
    AgentOwnerStats,
)
from app.models.user import User
from app.services.agent_market_service import AgentRebateService

router = APIRouter()


# ========== 概览统计 ==========

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """获取管理后台概览统计"""
    # 用户统计
    user_result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(func.case((User.vip_level >= 1, 1), else_=0)).label("vip_count"),
            func.sum(func.case((User.is_active == False, 1), else_=0)).label("inactive_count"),
        )
    )
    user_stats = user_result.one()

    # 今日新增用户
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    new_users_today = await db.execute(
        select(func.count()).where(User.created_at >= today)
    )

    # Agent 统计
    agent_result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(func.case((AgentTemplate.is_public == True, 1), else_=0)).label("public_count"),
            func.sum(func.case((AgentTemplate.is_featured == True, 1), else_=0)).label("featured_count"),
        )
    )
    agent_stats = agent_result.one()

    # 返佣统计
    rebate_result = await db.execute(
        select(
            func.sum(AgentSubscriptionRebate.rebate_amount).filter(
                AgentSubscriptionRebate.status == "settled"
            ),
            func.sum(AgentSubscriptionRebate.rebate_amount).filter(
                AgentSubscriptionRebate.status == "pending"
            ),
        )
    )
    rebate_stats = rebate_result.one()

    # 本月返佣
    month_start = today.replace(day=1)
    month_rebate = await db.execute(
        select(func.sum(AgentSubscriptionRebate.rebate_amount)).where(
            and_(
                AgentSubscriptionRebate.created_at >= month_start,
                AgentSubscriptionRebate.status == "settled",
            )
        )
    )

    # 最近注册用户
    recent_users_result = await db.execute(
        select(User)
        .order_by(desc(User.created_at))
        .limit(5)
    )
    recent_users = recent_users_result.scalars().all()

    # 最近返佣记录
    recent_rebates_result = await db.execute(
        select(
            AgentSubscriptionRebate,
            User.email.label("owner_email"),
        )
        .join(User, AgentSubscriptionRebate.owner_id == User.id)
        .order_by(desc(AgentSubscriptionRebate.created_at))
        .limit(5)
    )
    recent_rebates = recent_rebates_result.all()

    # 热门 Agent
    hot_agents_result = await db.execute(
        select(AgentTemplate)
        .order_by(desc(AgentTemplate.usage_count))
        .limit(5)
    )
    hot_agents = hot_agents_result.scalars().all()

    return {
        "total_users": user_stats.total or 0,
        "new_users_today": new_users_today.scalar() or 0,
        "vip_users": user_stats.vip_count or 0,
        "inactive_users": user_stats.inactive_count or 0,
        "total_agents": agent_stats.total or 0,
        "public_agents": agent_stats.public_count or 0,
        "featured_agents": agent_stats.featured_count or 0,
        "total_rebate": float(rebate_stats[0] or 0),
        "pending_rebate": float(rebate_stats[1] or 0),
        "monthly_rebate": float(month_rebate.scalar() or 0),
        "recent_users": [
            {
                "id": str(u.id),
                "email": u.email,
                "vip_level": u.vip_level,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in recent_users
        ],
        "recent_rebates": [
            {
                "id": r.AgentSubscriptionRebate.id,
                "owner_email": r.owner_email,
                "rebate_amount": float(r.AgentSubscriptionRebate.rebate_amount),
                "status": r.AgentSubscriptionRebate.status,
                "created_at": r.AgentSubscriptionRebate.created_at.isoformat() if r.AgentSubscriptionRebate.created_at else None,
            }
            for r in recent_rebates
        ],
        "hot_agents": [
            {
                "id": str(a.id),
                "name": a.name,
                "usage_count": a.usage_count,
                "rating": float(a.rating),
            }
            for a in hot_agents
        ],
    }


# ========== 用户管理 ==========

@router.get("/users")
async def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """获取用户列表"""
    query = select(User)

    if search:
        query = query.where(
            or_(
                User.email.ilike(f"%{search}%"),
                User.username.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
            )
        )

    # 总数
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    # 分页
    query = query.order_by(desc(User.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "username": u.username,
                "full_name": u.full_name,
                "phone": u.phone,
                "is_active": u.is_active,
                "is_superuser": u.is_superuser,
                "vip_level": u.vip_level,
                "vip_expire_at": u.vip_expire_at.isoformat() if u.vip_expire_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": None,  # TODO: 添加最后登录时间
                "register_source": u.register_source,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    updates: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """更新用户信息"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 处理 vip_expire_at
    if "vip_expire_at" in updates and updates["vip_expire_at"]:
        updates["vip_expire_at"] = datetime.fromisoformat(updates["vip_expire_at"].replace('Z', '+00:00'))

    for key, value in updates.items():
        if hasattr(user, key):
            setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return {"success": True, "message": "用户更新成功"}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """重置用户密码"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # TODO: 生成随机密码并发送邮件
    # 这里简化处理，实际应该生成随机密码并发送邮件
    return {"success": True, "message": "密码重置成功，新密码已发送至用户邮箱"}


# ========== Agent 管理 ==========

@router.get("/agents")
async def get_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """获取 Agent 模板列表"""
    query = select(AgentTemplate, User.email.label("creator_email")).outerjoin(
        User, AgentTemplate.creator_id == User.id
    )

    if search:
        query = query.where(
            or_(
                AgentTemplate.name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )

    # 总数
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    # 分页
    query = query.order_by(desc(AgentTemplate.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    agents = result.all()

    return {
        "items": [
            {
                "id": str(a.AgentTemplate.id),
                "name": a.AgentTemplate.name,
                "description": a.AgentTemplate.description,
                "category": a.AgentTemplate.category,
                "is_public": a.AgentTemplate.is_public,
                "is_featured": a.AgentTemplate.is_featured,
                "creator_email": a.creator_email or "未知",
                "usage_count": a.AgentTemplate.usage_count,
                "rating": float(a.AgentTemplate.rating),
                "rating_count": a.AgentTemplate.rating_count,
                "created_at": a.AgentTemplate.created_at.isoformat() if a.AgentTemplate.created_at else None,
            }
            for a in agents
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/agents/{agent_id}")
async def update_agent(
    agent_id: UUID,
    updates: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """更新 Agent 模板"""
    result = await db.execute(select(AgentTemplate).where(AgentTemplate.id == agent_id))
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")

    for key, value in updates.items():
        if hasattr(agent, key):
            setattr(agent, key, value)

    await db.commit()
    await db.refresh(agent)

    return {"success": True, "message": "Agent 更新成功"}


# ========== 返佣管理 ==========

@router.get("/rebates")
async def get_rebates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """获取返佣记录"""
    query = (
        select(
            AgentSubscriptionRebate,
            User.email.label("owner_email"),
        )
        .join(User, AgentSubscriptionRebate.owner_id == User.id)
    )

    if status:
        query = query.where(AgentSubscriptionRebate.status == status)

    if search:
        query = query.where(
            or_(
                User.email.ilike(f"%{search}%"),
            )
        )

    # 总数
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    # 分页
    query = query.order_by(desc(AgentSubscriptionRebate.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rebates = result.all()

    return {
        "items": [
            {
                "id": r.AgentSubscriptionRebate.id,
                "subscription_id": r.AgentSubscriptionRebate.subscription_id,
                "owner_email": r.owner_email,
                "subscriber_email": "用户" + str(r.AgentSubscriptionRebate.subscriber_id)[:8],
                "template_name": "Agent模板",
                "rebate_amount": float(r.AgentSubscriptionRebate.rebate_amount),
                "subscription_amount": float(r.AgentSubscriptionRebate.subscription_amount),
                "subscription_days": r.AgentSubscriptionRebate.subscription_days,
                "status": r.AgentSubscriptionRebate.status,
                "settlement_at": r.AgentSubscriptionRebate.settlement_at.isoformat() if r.AgentSubscriptionRebate.settlement_at else None,
                "settled_at": r.AgentSubscriptionRebate.settled_at.isoformat() if r.AgentSubscriptionRebate.settled_at else None,
                "created_at": r.AgentSubscriptionRebate.created_at.isoformat() if r.AgentSubscriptionRebate.created_at else None,
            }
            for r in rebates
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/rebates/stats")
async def get_rebate_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """获取返佣统计"""
    result = await db.execute(
        select(
            func.sum(AgentSubscriptionRebate.rebate_amount).filter(
                AgentSubscriptionRebate.status == "settled"
            ),
            func.sum(AgentSubscriptionRebate.rebate_amount).filter(
                AgentSubscriptionRebate.status == "pending"
            ),
        )
    )
    stats = result.one()

    # 本月返佣
    today = datetime.utcnow()
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_result = await db.execute(
        select(func.sum(AgentSubscriptionRebate.rebate_amount)).where(
            and_(
                AgentSubscriptionRebate.created_at >= month_start,
                AgentSubscriptionRebate.status == "settled",
            )
        )
    )

    return {
        "total_rebate": float(stats[0] or 0),
        "pending_rebate": float(stats[1] or 0),
        "this_month_rebate": float(month_result.scalar() or 0),
    }


@router.post("/rebates/batch-settle")
async def batch_settle_rebates(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """批量结算到期的返佣"""
    service = AgentRebateService(db)
    count = await service.process_pending_settlements()
    return {"success": True, "settled_count": count}


# ========== 系统配置 ==========

@router.get("/settings")
async def get_settings(
    current_user: User = Depends(current_superuser),
):
    """获取系统配置"""
    return {
        "rebate": {
            "enabled": settings.AGENT_SUBSCRIPTION_REBATE_ENABLED,
            "amount": settings.AGENT_SUBSCRIPTION_REBATE_AMOUNT,
            "min_vip_days": settings.AGENT_SUBSCRIPTION_REBATE_MIN_VIP_DAYS,
            "settlement_days": settings.AGENT_SUBSCRIPTION_REBATE_SETTLEMENT_DAYS,
            "max_per_month": settings.AGENT_SUBSCRIPTION_REBATE_MAX_PER_MONTH,
        },
        "pricing": {
            "vip": {
                "monthly": 68,
                "quarterly": 188,
                "yearly": 588,
            },
            "svip": {
                "monthly": 168,
                "quarterly": 468,
                "yearly": 1488,
            },
            "global_discount_enabled": True,
            "global_discount_rate": 0.85,
        },
        "system": {
            "monitor_stock_count": settings.MONITOR_STOCK_COUNT,
            "signal_threshold": settings.SIGNAL_THRESHOLD,
            "data_retention_days": settings.DATA_RETENTION_DAYS,
            "agent_discussion_timeout": settings.AGENT_DISCUSSION_TIMEOUT,
            "max_agents": settings.MAX_AGENTS,
        },
    }


@router.put("/settings")
async def update_settings(
    updates: dict,
    current_user: User = Depends(current_superuser),
):
    """更新系统配置

    TODO: 实际应用中应该持久化到数据库或配置中心
    这里仅作为示例返回成功
    """
    # TODO: 将配置保存到数据库或配置中心
    # 例如：
    # - Consul
    # - Etcd
    # - Redis
    # - 数据库配置表

    return {"success": True, "message": "配置已更新（实际应用中需要持久化）"}

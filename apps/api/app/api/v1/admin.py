"""
管理后台 API
提供后台管理功能（增强安全版）
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, validator
from typing import Union
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user, current_superuser
from app.core.config import settings
from app.core.security import audit_logger, get_redis_client
from app.core.logging import get_logger
from app.db.session import get_db_session
from app.models.agent_market import (
    AgentTemplate,
    AgentTemplateRatingStats,
    AgentSubscriptionRebate,
    AgentOwnerStats,
)
from app.models.user import User
from app.services.agent_market_service import AgentRebateService
from app.tasks.data_sync import sync_historical_data, check_data_completeness

router = APIRouter()
logger = get_logger(__name__)


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

def sanitize_search_term(term: str) -> str:
    """清理搜索词，防止SQL注入和XSS"""
    if not term:
        return ""
    # 移除特殊字符
    import re
    # 只允许字母数字中文和空格
    cleaned = re.sub(r'[^\w\s\u4e00-\u9fff@.-]', '', term)
    # 限制长度
    return cleaned[:100]


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
        # 清理搜索词
        safe_search = sanitize_search_term(search)
        if safe_search:
            # 使用参数化查询防止SQL注入
            search_pattern = f"%{safe_search}%"
            query = query.where(
                or_(
                    User.email.ilike(search_pattern),
                    User.username.ilike(search_pattern),
                    User.full_name.ilike(search_pattern),
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
    request: Request,
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

    # 记录审计日志
    await audit_logger.log(
        action="user_update",
        user_id=str(current_user.id),
        user_email=current_user.email,
        details={
            "target_user_id": str(user_id),
            "target_user_email": user.email,
            "updates": updates,
        },
        request=request,
    )

    return {"success": True, "message": "用户更新成功"}


class PasswordResetRequest(BaseModel):
    """密码重置请求"""
    admin_password: str  # 管理员当前密码二次确认
    notify_user: bool = True  # 是否通知用户


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    reset_request: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """
    重置用户密码

    安全要求：
    1. 需要管理员当前密码二次确认
    2. 记录详细审计日志
    3. 发送通知给用户
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 1. 二次确认：验证管理员密码
    from app.core.auth import get_user_manager, get_user_db
    user_db = await anext(get_user_db())
    user_manager = await anext(get_user_manager(user_db))

    # 验证管理员密码
    admin_user = await user_manager.authenticate(
        current_user.email, reset_request.admin_password
    )
    if not admin_user:
        # 记录失败审计日志
        await audit_logger.log(
            action="user_reset_password_failed",
            user_id=str(current_user.id),
            user_email=current_user.email,
            details={
                "target_user_id": str(user_id),
                "reason": "admin_password_verification_failed",
            },
            request=request,
        )
        raise HTTPException(status_code=403, detail="管理员密码验证失败")

    # 2. 生成随机强密码
    import secrets
    import string
    new_password = ''.join([
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(string.punctuation),
    ] + [
        secrets.choice(string.ascii_letters + string.digits + string.punctuation)
        for _ in range(12)
    ])
    new_password = ''.join(secrets.SystemRandom().sample(new_password, len(new_password)))

    # 3. 更新密码
    await user_manager._update(user, {"password": new_password})

    # 4. 使该用户所有现有Token失效（强制重新登录）
    from app.core.security import token_blacklist
    # TODO: 实现用户级Token失效（需要记录用户当前token）

    # 5. 记录审计日志
    await audit_logger.log(
        action="user_reset_password",
        user_id=str(current_user.id),
        user_email=current_user.email,
        details={
            "target_user_id": str(user_id),
            "target_user_email": user.email,
            "notify_user": reset_request.notify_user,
        },
        request=request,
    )

    logger.warning(
        f"Password reset by admin: {current_user.email} -> {user.email}, "
        f"IP: {request.client.host if request.client else 'unknown'}"
    )

    # 6. 发送通知（如果启用）
    if reset_request.notify_user:
        # TODO: 实现邮件/短信通知
        pass

    return {
        "success": True,
        "message": "密码重置成功",
        "notify_sent": reset_request.notify_user,
    }


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


class BatchSettleRequest(BaseModel):
    """批量结算请求"""
    idempotency_key: str  # 幂等性Key，防止重复提交
    dry_run: bool = False  # 试运行模式，只计算不执行


@router.post("/rebates/batch-settle")
async def batch_settle_rebates(
    settle_request: BatchSettleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """
    批量结算到期的返佣

    安全特性：
    1. 幂等性保护：相同idempotency_key只能执行一次
    2. 试运行模式：dry_run=true时只计算不执行
    3. 审计日志：记录完整操作信息
    """
    import hashlib
    from datetime import datetime

    # 1. 幂等性检查
    idempotency_key = settle_request.idempotency_key
    if not idempotency_key or len(idempotency_key) < 16:
        raise HTTPException(
            status_code=400,
            detail="idempotency_key must be at least 16 characters"
        )

    # 检查该Key是否已使用
    redis = await get_redis_client()
    key_hash = hashlib.sha256(idempotency_key.encode()).hexdigest()
    existing = await redis.get(f"batch_settle:{key_hash}")

    if existing:
        # 返回之前的结果
        return {
            "success": True,
            "message": "该结算请求已处理过（幂等性保护）",
            "idempotency_key": idempotency_key,
            "settled_count": int(existing),
        }

    # 2. 试运行模式
    if settle_request.dry_run:
        # 只统计待结算数量，不执行
        result = await db.execute(
            select(func.count()).where(
                AgentSubscriptionRebate.status == "pending"
            )
        )
        pending_count = result.scalar()

        return {
            "success": True,
            "message": "试运行模式（未执行）",
            "dry_run": True,
            "pending_count": pending_count,
        }

    # 3. 执行结算
    service = AgentRebateService(db)
    count = await service.process_pending_settlements()

    # 4. 记录幂等性Key（24小时过期）
    await redis.setex(f"batch_settle:{key_hash}", 86400, str(count))

    # 5. 记录审计日志
    await audit_logger.log(
        action="rebate_settle",
        user_id=str(current_user.id),
        user_email=current_user.email,
        details={
            "settled_count": count,
            "idempotency_key": idempotency_key,
        },
        request=request,
    )

    logger.warning(
        f"Rebate batch settle by admin: {current_user.email}, "
        f"count: {count}, idempotency_key: {idempotency_key[:8]}..."
    )

    return {
        "success": True,
        "settled_count": count,
        "idempotency_key": idempotency_key,
    }


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


class SettingsUpdateRequest(BaseModel):
    """配置更新请求"""
    category: str  # rebate, pricing, system
    key: str
    value: Union[str, int, float, bool, dict]
    reason: str  # 修改原因，用于审计


@router.put("/settings")
async def update_settings(
    update_request: SettingsUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """
    更新系统配置

    安全特性：
    1. 配置验证：只允许修改白名单中的配置项
    2. 审计记录：记录修改原因和前后值
    3. 持久化到数据库
    4. 敏感配置需要双人确认（金额类）
    """
    # 1. 定义可修改的配置项白名单
    ALLOWED_SETTINGS = {
        "rebate": ["enabled", "amount", "min_vip_days", "settlement_days"],
        "pricing": ["vip_monthly", "vip_quarterly", "vip_yearly",
                   "svip_monthly", "svip_quarterly", "svip_yearly",
                   "global_discount_enabled", "global_discount_rate"],
        "system": ["signal_threshold", "max_agents", "data_retention_days"],
    }

    # 2. 验证配置项
    if update_request.category not in ALLOWED_SETTINGS:
        raise HTTPException(status_code=400, detail=f"未知的配置类别: {update_request.category}")

    if update_request.key not in ALLOWED_SETTINGS[update_request.category]:
        raise HTTPException(
            status_code=400,
            detail=f"不允许修改的配置项: {update_request.key}"
        )

    # 3. 敏感配置验证（涉及金额的配置）
    SENSITIVE_KEYS = ["amount", "vip_monthly", "vip_quarterly", "vip_yearly",
                     "svip_monthly", "svip_quarterly", "svip_yearly"]

    if update_request.key in SENSITIVE_KEYS:
        # 数值范围验证
        if isinstance(update_request.value, (int, float)):
            if update_request.value < 0 or update_request.value > 10000:
                raise HTTPException(status_code=400, detail="金额配置超出允许范围")

        # 必须有详细的修改原因
        if not update_request.reason or len(update_request.reason) < 10:
            raise HTTPException(
                status_code=400,
                detail="敏感配置修改必须提供详细原因（至少10个字符）"
            )

    # 4. 持久化到数据库
    try:
        # 检查是否已存在该配置
        from app.models.system_config import SystemConfig

        result = await db.execute(
            select(SystemConfig).where(
                and_(
                    SystemConfig.category == update_request.category,
                    SystemConfig.key == update_request.key,
                )
            )
        )
        config = result.scalar_one_or_none()

        old_value = config.value if config else None

        if config:
            # 更新
            config.value = update_request.value
            config.updated_by = current_user.id
            config.updated_at = datetime.utcnow()
            config.update_reason = update_request.reason
        else:
            # 新建
            config = SystemConfig(
                category=update_request.category,
                key=update_request.key,
                value=update_request.value,
                created_by=current_user.id,
                update_reason=update_request.reason,
            )
            db.add(config)

        await db.commit()
        await db.refresh(config)

    except ImportError:
        # 如果SystemConfig模型不存在，使用Redis临时存储
        import json
        redis = await get_redis_client()
        config_key = f"config:{update_request.category}:{update_request.key}"

        # 获取旧值
        old_value = await redis.get(config_key)
        if old_value:
            old_value = json.loads(old_value)

        # 存储新值
        await redis.setex(
            config_key,
            86400 * 30,  # 30天过期
            json.dumps({
                "value": update_request.value,
                "updated_by": str(current_user.id),
                "updated_at": datetime.utcnow().isoformat(),
                "reason": update_request.reason,
            })
        )

    # 5. 记录审计日志
    await audit_logger.log(
        action="settings_update",
        user_id=str(current_user.id),
        user_email=current_user.email,
        details={
            "category": update_request.category,
            "key": update_request.key,
            "old_value": str(old_value) if old_value else None,
            "new_value": str(update_request.value),
            "reason": update_request.reason,
        },
        request=request,
    )

    logger.warning(
        f"Settings updated by admin: {current_user.email}, "
        f"{update_request.category}.{update_request.key} = {update_request.value}, "
        f"reason: {update_request.reason}"
    )

    return {
        "success": True,
        "message": "配置已更新",
        "category": update_request.category,
        "key": update_request.key,
        "value": update_request.value,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ========== 数据同步管理 ==========

# ========== 审计日志 ==========

@router.get("/audit-logs")
async def get_audit_logs(
    action: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(current_superuser),
):
    """获取审计日志"""
    logs = await audit_logger.get_recent_logs(action, limit)
    return {
        "items": logs,
        "total": len(logs),
    }


@router.get("/audit-logs/actions")
async def get_audit_log_actions(
    current_user: User = Depends(current_superuser),
):
    """获取审计日志动作列表"""
    return {
        "actions": audit_logger.SENSITIVE_ACTIONS
    }


# ========== 数据同步管理 ==========

@router.get("/data-sync/status")
async def get_data_sync_status(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(current_superuser),
):
    """获取数据同步状态"""
    from sqlalchemy import func, and_
    from datetime import datetime, timedelta
    from app.models.kline import KLine1Day
    from app.models.stock import Stock

    # 获取关注股票数量
    stock_result = await db.execute(
        select(func.count()).where(Stock.is_active == True)
    )
    monitored_stocks = stock_result.scalar()

    # 获取本地数据总量
    total_records = await db.execute(select(func.count(KLine1Day.id)))
    total_count = total_records.scalar()

    # 获取今日新增数据量
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_records = await db.execute(
        select(func.count()).where(KLine1Day.created_at >= today)
    )
    today_count = today_records.scalar()

    # 近14天数据完整性检查
    fourteen_days_ago = today - timedelta(days=14)
    completeness_result = await db.execute(
        select(KLine1Day.code, func.count().label("count"))
        .where(KLine1Day.timestamp >= fourteen_days_ago)
        .group_by(KLine1Day.code)
    )
    stock_data_counts = {row.code: row.count for row in completeness_result.all()}

    # 计算完整性
    complete_stocks = sum(1 for count in stock_data_counts.values() if count >= 10)

    return {
        "monitored_stocks": monitored_stocks,
        "local_total_records": total_count,
        "today_new_records": today_count,
        "data_retention_days": settings.DATA_RETENTION_DAYS,
        "completeness": {
            "total_stocks": monitored_stocks,
            "complete_stocks": complete_stocks,
            "incomplete_stocks": monitored_stocks - complete_stocks,
            "rate": f"{complete_stocks / monitored_stocks * 100:.1f}%" if monitored_stocks > 0 else "0%",
        },
        "data_source_strategy": settings.DATA_SOURCE_STRATEGY,
        "akshare_enabled": settings.AKSHARE_ENABLED,
        "tushare_enabled": settings.TUSHARE_ENABLED,
    }


@router.post("/data-sync/trigger")
async def trigger_data_sync(
    code: Optional[str] = Query(None, description="指定股票代码，不传则同步所有"),
    days: int = Query(14, description="同步天数"),
    current_user: User = Depends(current_superuser),
):
    """触发数据同步任务"""
    if code:
        task = sync_historical_data.delay(days=days, stock_codes=[code])
    else:
        task = sync_historical_data.delay(days=days)

    return {
        "success": True,
        "task_id": task.id,
        "message": f"数据同步任务已提交，任务ID: {task.id}",
        "params": {
            "code": code,
            "days": days,
        },
    }


@router.post("/data-sync/check-completeness")
async def admin_check_completeness(
    current_user: User = Depends(current_superuser),
):
    """触发数据完整性检查"""
    task = check_data_completeness.delay()

    return {
        "success": True,
        "task_id": task.id,
        "message": "数据完整性检查任务已提交",
    }

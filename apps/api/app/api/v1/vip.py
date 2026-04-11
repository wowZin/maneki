"""
VIP 相关 API
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user, current_superuser
from app.db.session import get_db_session
from app.models.user import User

router = APIRouter()


@router.get("/vip/status")
async def get_vip_status(
    current_user: User = Depends(current_active_user),
):
    """获取用户VIP状态"""
    return {
        "is_vip": current_user.is_vip,
        "vip_level": current_user.vip_level,
        "vip_expire_at": current_user.vip_expire_at.isoformat() if current_user.vip_expire_at else None,
        "days_remaining": (
            (current_user.vip_expire_at - datetime.utcnow()).days
            if current_user.vip_expire_at and current_user.vip_expire_at > datetime.utcnow()
            else 0
        ),
        "features": {
            "replay": current_user.is_vip,
            "auto_weight": current_user.is_vip,
            "custom_agent": current_user.is_vip,
            "delete_agent": current_user.is_vip,
            "market_publish": current_user.is_vip,
        }
    }


@router.post("/vip/upgrade", dependencies=[Depends(current_superuser)])
async def upgrade_vip(
    user_id: str,
    days: int = 30,
    level: int = 1,
    db: AsyncSession = Depends(get_db_session),
):
    """
    升级用户VIP（仅管理员）
    
    实际项目中应该对接支付系统
    """
    from sqlalchemy import select
    from uuid import UUID
    
    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 设置VIP
    user.vip_level = level
    
    # 计算过期时间
    if user.vip_expire_at and user.vip_expire_at > datetime.utcnow():
        # 续费，在现有基础上增加
        user.vip_expire_at = user.vip_expire_at + timedelta(days=days)
    else:
        # 新开通
        user.vip_expire_at = datetime.utcnow() + timedelta(days=days)
    
    await db.commit()
    
    return {
        "success": True,
        "user_id": str(user.id),
        "vip_level": user.vip_level,
        "vip_expire_at": user.vip_expire_at.isoformat(),
        "days": days,
    }

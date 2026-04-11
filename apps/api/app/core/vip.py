"""
VIP/SVIP 权限检查
"""

from typing import Optional
from datetime import datetime

from fastapi import Depends, HTTPException, status

from app.core.auth import current_active_user
from app.models.user import User


class VIPLevel:
    """VIP等级常量"""
    FREE = 0      # 普通用户
    VIP = 1       # VIP
    SVIP = 2      # SVIP


class VIPRequired:
    """VIP权限检查依赖"""

    def __init__(self, min_level: int = 1):
        self.min_level = min_level

    async def __call__(
        self,
        current_user: User = Depends(current_active_user),
    ) -> User:
        # 检查VIP等级
        if current_user.vip_level < self.min_level:
            level_name = "SVIP" if self.min_level == 2 else "VIP"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": f"此功能需要{level_name}权限",
                    "code": "VIP_REQUIRED",
                    "current_level": current_user.vip_level,
                    "required_level": self.min_level,
                    "level_name": level_name,
                }
            )

        # 检查VIP是否过期
        if current_user.vip_expire_at and current_user.vip_expire_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "VIP已过期，请续费",
                    "code": "VIP_EXPIRED",
                    "expired_at": current_user.vip_expire_at.isoformat(),
                }
            )

        return current_user


# 常用VIP检查实例
current_vip_user = VIPRequired(min_level=VIPLevel.VIP)
current_svip_user = VIPRequired(min_level=VIPLevel.SVIP)


class VIPFeature:
    """VIP功能常量"""
    # 免费功能（level 0）
    BASIC_AGENT = "basic_agent"        # 基础Agent
    MANUAL_WEIGHT = "manual_weight"    # 手动调整权重
    MAKE_DECISION = "make_decision"    # 执行决策
    FEATURED_AGENT = "featured_agent"  # 使用精选Agent（免费用户可用）

    # VIP功能（level 1）
    REPLAY = "replay"                  # 复盘
    AUTO_WEIGHT = "auto_weight"        # 自动权重修正
    WEIGHT_EVALUATION = "weight_evaluation"  # 权重评估
    AGENT_HISTORY = "agent_history"    # 查看Agent历史

    # SVIP功能（level 2）
    CUSTOM_AGENT = "custom_agent"      # 自定义Agent
    DELETE_AGENT = "delete_agent"      # 删除Agent
    MARKET_CLONE = "market_clone"      # 从市场克隆任意模板
    MARKET_PUBLISH = "market_publish"  # 发布到市场


def check_vip_feature(user: User, feature: str) -> bool:
    """
    检查用户是否有权限使用特定功能

    权限层级：
    - Level 0 (Free): basic_agent, manual_weight, make_decision, featured_agent
    - Level 1 (VIP): replay, auto_weight, weight_evaluation, agent_history
    - Level 2 (SVIP): custom_agent, delete_agent, market_clone, market_publish
    """
    # 超级用户拥有所有权限
    if user.is_superuser:
        return True

    # 检查VIP是否过期
    if user.vip_expire_at and user.vip_expire_at < datetime.utcnow():
        return False

    # Level 0 功能 - 免费
    free_features = [
        VIPFeature.BASIC_AGENT,
        VIPFeature.MANUAL_WEIGHT,
        VIPFeature.MAKE_DECISION,
        VIPFeature.FEATURED_AGENT,
    ]
    if feature in free_features:
        return True

    # Level 1 功能 - 需要VIP
    vip_features = [
        VIPFeature.REPLAY,
        VIPFeature.AUTO_WEIGHT,
        VIPFeature.WEIGHT_EVALUATION,
        VIPFeature.AGENT_HISTORY,
    ]
    if feature in vip_features:
        return user.vip_level >= VIPLevel.VIP

    # Level 2 功能 - 需要SVIP
    svip_features = [
        VIPFeature.CUSTOM_AGENT,
        VIPFeature.DELETE_AGENT,
        VIPFeature.MARKET_CLONE,
        VIPFeature.MARKET_PUBLISH,
    ]
    if feature in svip_features:
        return user.vip_level >= VIPLevel.SVIP

    # 未知功能，默认拒绝
    return False


def can_use_template(user: User, template: object) -> bool:
    """
    检查用户是否可以使用特定模板

    规则：
    - 精选模板(is_featured=True)：所有用户可用（包括免费用户）
    - 普通公开模板：需要SVIP权限才能克隆
    - 自己的模板：始终可用
    """
    # 超级用户拥有所有权限
    if user.is_superuser:
        return True

    # 检查VIP是否过期
    if user.vip_expire_at and user.vip_expire_at < datetime.utcnow():
        # VIP过期只能使用精选模板
        return getattr(template, 'is_featured', False)

    # 自己的模板始终可用
    if getattr(template, 'creator_id', None) == user.id:
        return True

    # 精选模板对所有人开放
    if getattr(template, 'is_featured', False):
        return True

    # 其他公开模板需要SVIP
    return user.vip_level >= VIPLevel.SVIP


def get_vip_tier(level: int) -> str:
    """获取VIP等级名称"""
    tiers = {
        VIPLevel.FREE: "free",
        VIPLevel.VIP: "vip",
        VIPLevel.SVIP: "svip",
    }
    return tiers.get(level, "unknown")


def get_user_features(user: User) -> dict:
    """获取用户所有功能权限"""
    # 检查VIP是否过期
    is_vip_expired = user.vip_expire_at and user.vip_expire_at < datetime.utcnow()
    effective_vip_level = 0 if is_vip_expired else user.vip_level

    return {
        # 免费功能
        VIPFeature.BASIC_AGENT: True,
        VIPFeature.MANUAL_WEIGHT: True,
        VIPFeature.MAKE_DECISION: True,
        VIPFeature.FEATURED_AGENT: True,

        # VIP功能
        VIPFeature.REPLAY: effective_vip_level >= VIPLevel.VIP,
        VIPFeature.AUTO_WEIGHT: effective_vip_level >= VIPLevel.VIP,
        VIPFeature.WEIGHT_EVALUATION: effective_vip_level >= VIPLevel.VIP,
        VIPFeature.AGENT_HISTORY: effective_vip_level >= VIPLevel.VIP,

        # SVIP功能
        VIPFeature.CUSTOM_AGENT: effective_vip_level >= VIPLevel.SVIP,
        VIPFeature.DELETE_AGENT: effective_vip_level >= VIPLevel.SVIP,
        VIPFeature.MARKET_CLONE: effective_vip_level >= VIPLevel.SVIP,
        VIPFeature.MARKET_PUBLISH: effective_vip_level >= VIPLevel.SVIP,
    }

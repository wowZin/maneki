"""
用户相关Schema
"""

import uuid
from typing import Optional

from fastapi_users import schemas
import uuid


class UserRead(schemas.BaseUser[uuid.UUID]):
    """用户读取Schema - 支持微信用户（email/username 可选）"""

    username: Optional[str] = None
    nickname: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

    # 微信相关（只读）
    wechat_unionid: Optional[str] = None
    wechat_mp_openid: Optional[str] = None
    wechat_mini_openid: Optional[str] = None
    wechat_auth_type: Optional[str] = None
    register_source: str = "email"

    # 辅助属性
    is_wechat_user: bool = False
    need_bind_phone: bool = False

    class Config:
        from_attributes = True


class UserCreate(schemas.BaseUserCreate):
    """用户创建Schema - 支持微信免密创建"""

    username: Optional[str] = None
    nickname: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

    # 微信登录相关
    wechat_unionid: Optional[str] = None
    wechat_mp_openid: Optional[str] = None
    wechat_mini_openid: Optional[str] = None
    wechat_session_key: Optional[str] = None
    wechat_auth_type: Optional[str] = None
    register_source: str = "email"


class UserUpdate(schemas.BaseUserUpdate):
    """用户更新Schema"""

    username: Optional[str] = None
    nickname: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

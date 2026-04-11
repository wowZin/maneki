"""
认证配置
FastAPI-Users 配置
"""

import uuid
from typing import Optional

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase

from app.models.user import User
from app.db.session import get_db_session
from app.core.config import settings


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """用户管理器"""

    reset_password_token_secret = settings.SECRET_KEY if hasattr(settings, 'SECRET_KEY') else "your-secret-key-change-in-production"
    verification_token_secret = settings.SECRET_KEY if hasattr(settings, 'SECRET_KEY') else "your-secret-key-change-in-production"

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        """注册后回调"""
        print(f"用户注册成功: {user.email}")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """忘记密码后回调"""
        print(f"用户 {user.email} 忘记密码. 重置令牌: {token}")

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """请求验证后回调"""
        print(f"验证请求 {user.email}. 验证令牌: {token}")


async def get_user_db():
    """获取用户数据库"""
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        yield SQLAlchemyUserDatabase(session, User)


async def get_user_manager(user_db=Depends(get_user_db)):
    """获取用户管理器"""
    yield UserManager(user_db)


async def validate_token_not_blacklisted(token: str) -> bool:
    """验证Token是否在黑名单中"""
    from app.core.security import token_blacklist
    return not await token_blacklist.is_blacklisted(token)


class CustomJWTStrategy(JWTStrategy):
    """自定义JWT策略，增加黑名单检查"""

    async def read_token(self, token: str, user_manager) -> dict:
        """读取Token并检查黑名单"""
        # 先检查黑名单
        if await token_blacklist.is_blacklisted(token):
            return None
        return await super().read_token(token, user_manager)


def get_jwt_strategy() -> CustomJWTStrategy:
    """JWT策略（带黑名单检查）"""
    secret = settings.SECRET_KEY
    if not secret:
        raise ValueError("SECRET_KEY must be set in production")
    return CustomJWTStrategy(
        secret=secret,
        lifetime_seconds=3600 * 24 * 7,  # 7天有效期
    )


# Bearer 传输
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

# 认证后端
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# FastAPI-Users 实例
fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

# 当前用户依赖
current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)

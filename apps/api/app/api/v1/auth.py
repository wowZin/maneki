"""
认证相关API
使用 FastAPI-Users
"""

from fastapi import APIRouter

from app.core.auth import fastapi_users, auth_backend
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter()

# 注册路由
router.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/jwt",
    tags=["auth"],
)

# 注册路由
router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="",
    tags=["auth"],
)

# 重置密码路由
router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="",
    tags=["auth"],
)

# 验证邮箱路由
router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="",
    tags=["auth"],
)

# 用户管理路由
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

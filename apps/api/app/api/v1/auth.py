"""
认证相关API
使用 FastAPI-Users + 增强安全功能
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.auth import fastapi_users, auth_backend, get_user_manager, UserManager
from app.core.security import login_protection, audit_logger, token_blacklist
from app.core.logging import get_logger
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter()
logger = get_logger(__name__)

security = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> str:
    """获取客户端 IP"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"


async def check_login_protection(request: Request, email: str):
    """检查登录保护"""
    ip = get_client_ip(request)

    # 检查是否被锁定
    can_login, lock_time = await login_protection.check_login_attempts(email, ip)

    if not can_login:
        logger.warning(f"Login attempt for locked account: {email}, IP: {ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked. Try again in {lock_time} seconds."
        )

    return ip


async def record_login_success(request: Request, email: str, user):
    """记录登录成功"""
    ip = get_client_ip(request)
    await login_protection.clear_attempts(email, ip)

    await audit_logger.log(
        action="login_success",
        user_id=str(user.id),
        user_email=email,
        details={"ip": ip},
        request=request,
    )
    logger.info(f"User login success: {email}, IP: {ip}")


async def record_login_failure(request: Request, email: str, reason: str):
    """记录登录失败"""
    ip = get_client_ip(request)
    await login_protection.record_failed_attempt(email, ip)

    status_info = await login_protection.get_attempts_status(email, ip)

    await audit_logger.log(
        action="login_failed",
        user_email=email,
        details={
            "ip": ip,
            "reason": reason,
            "remaining_attempts": status_info["account_remaining"],
        },
        request=request,
    )
    logger.warning(f"User login failed: {email}, IP: {ip}, Reason: {reason}")


# 标准 FastAPI-Users 路由
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


@router.post("/logout", tags=["auth"])
async def logout(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    退出登录 - 将 Token 加入黑名单
    """
    if credentials:
        token = credentials.credentials
        # 解析 token 获取过期时间
        try:
            from jose import jwt
            from app.core.config import settings

            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_exp": False}
            )
            exp = payload.get("exp", 0)

            # 加入黑名单
            await token_blacklist.add_to_blacklist(token, exp)

            # 记录审计日志
            user_id = payload.get("sub")
            await audit_logger.log(
                action="logout",
                user_id=user_id,
                details={"ip": get_client_ip(request)},
                request=request,
            )

            logger.info(f"User logout: {user_id}")
        except Exception as e:
            logger.error(f"Logout error: {e}")

    return {"success": True, "message": "Logged out successfully"}


@router.get("/login/status", tags=["auth"])
async def login_status(
    request: Request,
    email: str,
):
    """
    获取登录状态（剩余尝试次数）
    """
    ip = get_client_ip(request)
    status_info = await login_protection.get_attempts_status(email, ip)

    return {
        "email": email,
        "account_remaining_attempts": status_info["account_remaining"],
        "ip_remaining_attempts": status_info["ip_remaining"],
        "can_login": status_info["account_fails"] < 5 and status_info["ip_fails"] < 10,
    }

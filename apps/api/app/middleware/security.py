"""
安全中间件
- 安全头
- IP 白名单
- Token 黑名单检查
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.security import (
    SecurityHeaders,
    ip_whitelist,
    audit_logger,
)
from app.core.logging import get_logger

logger = get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """安全响应头中间件"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # 添加安全头
        headers = SecurityHeaders.get_security_headers()
        for key, value in headers.items():
            response.headers[key] = value

        # API 特定头
        response.headers["X-API-Version"] = "1.0"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

        return response


class AdminIPWhitelistMiddleware(BaseHTTPMiddleware):
    """管理后台 IP 白名单中间件"""

    # 不需要白名单检查的路径
    EXEMPT_PATHS = ["/health", "/docs", "/openapi.json"]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 只检查 admin 路径（修正路径匹配）
        if not path.startswith("/api/v1/admin"):
            return await call_next(request)

        # 豁免路径
        if any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
            return await call_next(request)

        # 获取客户端 IP
        client_ip = self._get_client_ip(request)

        # 检查白名单
        if not ip_whitelist.is_allowed(client_ip):
            logger.warning(
                f"Admin access denied for IP: {client_ip}, path: {path}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="IP not in whitelist"
            )

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        if request.client:
            return request.client.host

        return "unknown"


class RequestAuditMiddleware(BaseHTTPMiddleware):
    """请求审计中间件 - 记录敏感操作"""

    SENSITIVE_PATHS = [
        ("/admin/users", ["POST", "PUT", "DELETE"]),
        ("/admin/agents", ["PUT", "DELETE"]),
        ("/admin/settings", ["PUT"]),
        ("/admin/rebates/batch-settle", ["POST"]),
    ]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # 检查是否是敏感操作
        is_sensitive = self._is_sensitive_operation(path, method)

        if is_sensitive:
            # 获取用户信息（如果有）
            user_id = None
            user_email = None

            # 从请求状态获取用户信息（如果已认证）
            if hasattr(request.state, "user"):
                user = request.state.user
                user_id = str(user.id) if user else None
                user_email = user.email if user else None

            # 记录审计日志
            await audit_logger.log(
                action=f"{method.lower()}_{path.replace('/', '_')}",
                user_id=user_id,
                user_email=user_email,
                details={
                    "path": path,
                    "method": method,
                },
                request=request,
            )

        return await call_next(request)

    def _is_sensitive_operation(self, path: str, method: str) -> bool:
        """检查是否是敏感操作"""
        for prefix, methods in self.SENSITIVE_PATHS:
            if path.startswith(prefix) and method in methods:
                return True
        return False


class APISecurityMiddleware(BaseHTTPMiddleware):
    """API 安全中间件 - 综合安全检查"""

    # 禁止的 User-Agent 模式
    BLOCKED_UA_PATTERNS = [
        "sqlmap",
        "nmap",
        "nessus",
        "nikto",
        "burp",
        "metasploit",
        "dirbuster",
        "gobuster",
    ]

    async def dispatch(self, request: Request, call_next):
        # 检查 User-Agent
        user_agent = request.headers.get("user-agent", "").lower()
        if any(pattern in user_agent for pattern in self.BLOCKED_UA_PATTERNS):
            logger.warning(f"Blocked suspicious User-Agent: {user_agent}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )

        # 检查请求大小
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Request too large"
            )

        response = await call_next(request)

        # 添加请求 ID
        request_id = request.headers.get("x-request-id", "")
        if request_id:
            response.headers["X-Request-ID"] = request_id

        return response

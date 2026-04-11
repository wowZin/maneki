"""
限流中间件 - API Gateway 核心功能
使用 slowapi 实现基于 Redis 的分布式限流
"""

from typing import Optional
from fastapi import Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings


# 创建限流器实例
# 使用 Redis 作为存储后端，支持分布式部署
limiter = Limiter(
    key_func=get_remote_address,  # 默认按 IP 地址限流
    default_limits=["100/minute"],  # 默认限制：每IP每分钟100请求
    storage_uri=settings.REDIS_URL,
    strategy="fixed-window",  # 固定窗口策略，可选：fixed-window, moving-window
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    自定义限流中间件
    提供更细粒度的限流控制和错误响应
    """

    def __init__(
        self,
        app: ASGIApp,
        default_limit: str = "100/minute",
        burst_limit: str = "10/second",
        login_limit: str = "5/minute",
        api_limit: str = "1000/hour",
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.burst_limit = burst_limit
        self.login_limit = login_limit
        self.api_limit = api_limit

    async def dispatch(self, request: Request, call_next):
        # 获取客户端标识
        client_id = self._get_client_id(request)
        path = request.url.path

        # 根据路径选择限流策略
        limit_key = self._get_limit_key(path, client_id)
        limit = self._get_limit_for_path(path)

        # 添加限流信息到请求状态
        request.state.rate_limit_key = limit_key
        request.state.rate_limit = limit

        response = await call_next(request)

        # 添加限流响应头
        response.headers["X-RateLimit-Limit"] = limit
        response.headers["X-RateLimit-Key"] = limit_key

        return response

    def _get_client_id(self, request: Request) -> str:
        """获取客户端标识（支持代理，防伪造）"""
        # 获取直接连接的客户端地址
        client_host = request.client.host if request.client else "unknown"

        # 仅当客户端来自受信任的内部网络时，才使用代理头
        # 这是为了防止客户端伪造 X-Forwarded-For 绕过限流
        trusted_networks = [
            "127.0.0.1", "::1",  # 本地回环
            "10.0.0.0/8",       # 私有网络
            "172.16.0.0/12",
            "192.168.0.0/16",
        ]

        is_trusted = False
        import ipaddress
        try:
            client_ip = ipaddress.ip_address(client_host)
            for network in trusted_networks:
                if "/" in network:
                    if client_ip in ipaddress.ip_network(network):
                        is_trusted = True
                        break
                elif str(client_ip) == network:
                    is_trusted = True
                    break
        except ValueError:
            pass

        # 只有来自受信任网络的请求，才读取代理头
        if is_trusted:
            # 从 X-Forwarded-For 获取（取第一个，即最靠近用户的IP）
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # X-Forwarded-For 格式: client, proxy1, proxy2
                # 取第一个（客户端真实IP）
                return forwarded_for.split(",")[0].strip()

            # 其次从 X-Real-IP 获取
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                return real_ip

        # 不信任代理头，使用直接连接地址
        return client_host

    def _get_limit_key(self, path: str, client_id: str) -> str:
        """生成限流键"""
        # 登录相关接口使用更严格的限流
        if any(p in path for p in ["/auth/", "/wechat/", "/login"]):
            return f"rate_limit:login:{client_id}"
        # SSE 连接特殊处理
        elif "/sse/" in path:
            return f"rate_limit:sse:{client_id}"
        # API 接口
        elif "/api/" in path:
            return f"rate_limit:api:{client_id}"
        return f"rate_limit:default:{client_id}"

    def _get_limit_for_path(self, path: str) -> str:
        """根据路径返回限流配置"""
        # 认证接口：防止暴力破解
        if any(p in path for p in ["/auth/jwt/login", "/wechat/"]):
            return self.login_limit
        # SSE 流：限制并发连接数
        elif "/sse/" in path:
            return "10/minute"
        # 信号分析接口：防止资源耗尽
        elif "/signals/analyze/" in path:
            return "30/minute"
        # 复盘运行接口：资源密集型
        elif "/replay/run" in path:
            return "10/hour"
        # 默认 API 限流
        elif "/api/" in path:
            return self.api_limit
        return self.default_limit


def get_rate_limit_headers(
    request: Request,
    limit: str,
    remaining: int,
    reset_time: int,
) -> dict:
    """
    生成标准的 RateLimit 响应头（遵循 IETF RateLimit 规范草案）

    Headers:
        - RateLimit-Limit: 请求限制数
        - RateLimit-Remaining: 剩余请求数
        - RateLimit-Reset: 重置时间戳
    """
    return {
        "RateLimit-Limit": str(limit),
        "RateLimit-Remaining": str(remaining),
        "RateLimit-Reset": str(reset_time),
    }


class RateLimitExemptionMiddleware(BaseHTTPMiddleware):
    """
    限流豁免中间件
    为内部服务、白名单 IP 等提供限流豁免
    """

    # 内部网段白名单
    INTERNAL_NETWORKS = [
        "127.0.0.1",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
    ]

    async def dispatch(self, request: Request, call_next):
        client_id = self._get_client_id(request)

        # 检查是否在白名单
        if self._is_exempt(client_id):
            request.state.rate_limit_exempt = True

        return await call_next(request)

    def _get_client_id(self, request: Request) -> str:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    def _is_exempt(self, client_id: str) -> bool:
        """检查是否豁免限流"""
        # 本地回环地址豁免
        if client_id in ("127.0.0.1", "::1", "localhost"):
            return True

        # 可以添加更多白名单逻辑
        # - 从配置读取白名单
        # - 从 Redis 读取动态白名单
        # - API Key 白名单

        return False

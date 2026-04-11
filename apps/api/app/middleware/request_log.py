"""
请求日志中间件 - API Gateway 核心功能
记录所有请求的详细信息和性能指标
支持本地开发和阿里云环境
"""

import time
import uuid
from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.logging import logger, request_logger, ENV_ALIYUN


class RequestLogMiddleware(BaseHTTPMiddleware):
    """
    请求日志中间件

    功能：
    1. 为每个请求生成唯一 Trace ID
    2. 记录请求详细信息（方法、路径、参数、头部等）
    3. 记录响应信息（状态码、耗时）
    4. 记录性能指标
    5. 支持结构化日志输出（JSON 格式便于 SLS 采集）
    """

    def __init__(
        self,
        app: ASGIApp,
        log_level: str = "INFO",
        log_body: bool = False,  # 是否记录请求体（可能包含敏感信息）
        slow_request_threshold: float = 1.0,  # 慢请求阈值（秒）
    ):
        super().__init__(app)
        self.log_level = log_level
        self.log_body = log_body
        self.slow_request_threshold = slow_request_threshold

    async def dispatch(self, request: Request, call_next):
        # 生成 Trace ID（优先从请求头获取，用于分布式追踪）
        trace_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:16]
        request.state.trace_id = trace_id

        # 记录开始时间
        start_time = time.time()

        # 获取客户端信息
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "-")

        # 执行请求
        try:
            response = await call_next(request)

            # 计算耗时
            process_time = time.time() - start_time

            # 添加自定义响应头
            response.headers["X-Request-ID"] = trace_id
            response.headers["X-Response-Time"] = f"{process_time:.3f}s"

            # 使用统一日志接口记录请求
            request_logger.log_request(
                trace_id=trace_id,
                method=request.method,
                path=request.url.path,
                client_ip=client_ip,
                user_agent=user_agent,
                duration=process_time,
                status_code=response.status_code,
                extra={
                    "query": str(request.query_params),
                    "is_slow": process_time > self.slow_request_threshold,
                }
            )

            # 慢请求警告
            if process_time > self.slow_request_threshold:
                logger.warning(
                    f"[{trace_id}] SLOW REQUEST: {request.method} {request.url.path} took {process_time:.3f}s"
                )

            return response

        except Exception as exc:
            # 记录异常
            process_time = time.time() - start_time
            request_logger.log_error(
                trace_id=trace_id,
                error_type=type(exc).__name__,
                error_msg=str(exc),
                path=request.url.path,
            )
            raise

    def _get_client_ip(self, request: Request) -> str:
        """获取客户端真实 IP"""
        # 优先从代理头获取（阿里云 SLB 会注入这些头）
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        if request.client:
            return request.client.host

        return "unknown"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    请求上下文中间件
    将请求信息注入日志上下文，方便追踪
    """

    async def dispatch(self, request: Request, call_next):
        trace_id = getattr(request.state, "trace_id", "unknown")

        # 使用 loguru 的上下文绑定（仅本地开发）
        if ENV_ALIYUN != "aliyun":
            from app.core.logging import loguru_logger
            with loguru_logger.contextualize(trace_id=trace_id, path=request.url.path):
                response = await call_next(request)
                return response
        else:
            response = await call_next(request)
            return response

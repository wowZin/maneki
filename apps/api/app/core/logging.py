"""
日志适配器 - 支持本地开发和阿里云环境

本地开发: 使用 loguru 输出到控制台/文件
阿里云环境: 输出到 stdout（由 Logtail 采集到 SLS）
"""

import json
import sys
import os
from typing import Any, Dict, Optional
from contextvars import ContextVar
from datetime import datetime

from loguru import logger as loguru_logger

# 请求上下文变量
request_context: ContextVar[Dict[str, Any]] = ContextVar("request_context", default={})

# 环境标识
ENV_LOCAL = "local"
ENV_ALIYUN = "aliyun"
ENV = os.getenv("APP_ENV", ENV_LOCAL)

# 阿里云 SLS 配置（通过环境变量注入）
SLS_PROJECT = os.getenv("SLS_PROJECT", "")
SLS_LOGSTORE = os.getenv("SLS_LOGSTORE", "maneki-api")
SLS_ENDPOINT = os.getenv("SLS_ENDPOINT", "")


class StructuredLogFormatter:
    """
    结构化日志格式化器
    输出 JSON 格式便于阿里云 SLS 解析
    """

    @staticmethod
    def format(record: Dict[str, Any]) -> str:
        # 基础字段
        log_entry = {
            "time": datetime.utcnow().isoformat() + "Z",
            "level": record.get("level", {}).get("name", "INFO"),
            "message": record.get("message", ""),
            "source": record.get("name", "app"),
        }

        # 添加上下文信息
        extra = record.get("extra", {})
        log_entry.update(extra)

        # 异常信息
        if record.get("exception"):
            log_entry["exception"] = str(record["exception"])

        # 阿里云 SLS 特殊字段（便于索引和查询）
        if ENV == ENV_ALIYUN:
            log_entry["__source__"] = "maneki-api"
            log_entry["__topic__"] = record.get("extra", {}).get("event", "default")
            # 阿里云 SLS 推荐字段
            log_entry["app_name"] = "maneki-api"
            log_entry["env"] = ENV

        return json.dumps(log_entry, ensure_ascii=False, default=str)


def setup_logging():
    """
    配置日志系统
    根据环境自动选择输出方式
    """
    # 移除默认处理器
    loguru_logger.remove()

    if ENV == ENV_ALIYUN:
        # 阿里云环境：输出到 stdout，由 Logtail 采集到 SLS
        # 格式化为单行 JSON
        loguru_logger.add(
            sys.stdout,
            format="{message}",  # 只输出 JSON 内容
            serialize=False,  # 我们自定义格式化
            level=os.getenv("LOG_LEVEL", "INFO"),
            colorize=False,
        )

        # 添加拦截器，格式化日志为 JSON
        def json_sink(message):
            record = message.record
            formatted = StructuredLogFormatter.format(record)
            print(formatted, flush=True)

        loguru_logger.add(
            json_sink,
            level=os.getenv("LOG_LEVEL", "INFO"),
        )

    else:
        # 本地开发环境：美化格式输出
        loguru_logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
                   "<level>{level: <8}</level> | "
                   "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                   "<level>{message}</level>",
            level=os.getenv("LOG_LEVEL", "DEBUG"),
            colorize=True,
            enqueue=True,
        )

        # 同时写入文件（本地开发）
        loguru_logger.add(
            "logs/app_{time:YYYY-MM-DD}.log",
            rotation="00:00",  # 每天轮转
            retention="14 days",  # 保留14天
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
            level="INFO",
            encoding="utf-8",
            enqueue=True,
        )

    return loguru_logger


# 全局日志实例
logger = setup_logging()


class AliyunSLSClient:
    """
    阿里云 SLS 客户端（可选直接写入）
    用于需要实时日志投递的场景
    """

    def __init__(self):
        self.project = SLS_PROJECT
        self.logstore = SLS_LOGSTORE
        self.endpoint = SLS_ENDPOINT
        self._client = None

        if ENV == ENV_ALIYUN and SLS_PROJECT:
            try:
                from aliyun.log import LogClient
                access_key_id = os.getenv("ALIBABA_CLOUD_ACCESS_KEY_ID")
                access_key_secret = os.getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET")

                if access_key_id and access_key_secret:
                    self._client = LogClient(
                        endpoint=self.endpoint,
                        accessKeyId=access_key_id,
                        accessKeySecret=access_key_secret,
                    )
            except ImportError:
                logger.warning("aliyun-log-python-sdk 未安装，将使用 stdout 方式")

    def put_logs(self, logs: list):
        """
        批量写入日志到 SLS
        """
        if not self._client or not logs:
            return

        try:
            from aliyun.log import PutLogsRequest, LogItem

            log_items = []
            for log in logs:
                contents = [(k, str(v)) for k, v in log.items()]
                log_items.append(LogItem(
                    timestamp=int(datetime.utcnow().timestamp()),
                    contents=contents
                ))

            request = PutLogsRequest(
                project=self.project,
                logstore=self.logstore,
                topic="api-request",
                logitems=log_items,
            )
            self._client.put_logs(request)
        except Exception as e:
            logger.error(f"写入 SLS 失败: {e}")


# SLS 客户端实例（延迟初始化）
_sls_client: Optional[AliyunSLSClient] = None


def get_sls_client() -> AliyunSLSClient:
    """获取 SLS 客户端单例"""
    global _sls_client
    if _sls_client is None:
        _sls_client = AliyunSLSClient()
    return _sls_client


class RequestLogger:
    """
    请求日志记录器
    统一的请求日志格式，兼容阿里云 SLS
    """

    @staticmethod
    def log_request(
        trace_id: str,
        method: str,
        path: str,
        client_ip: str,
        user_agent: str,
        duration: float,
        status_code: int,
        user_id: Optional[str] = None,
        extra: Optional[Dict] = None,
    ):
        """
        记录 API 请求日志
        """
        log_data = {
            "trace_id": trace_id,
            "event": "api_request",
            "method": method,
            "path": path,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "duration_ms": round(duration * 1000, 2),
            "status_code": status_code,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        if user_id:
            log_data["user_id"] = user_id

        if extra:
            log_data.update(extra)

        if ENV == ENV_ALIYUN:
            # 阿里云环境：结构化日志
            logger.info(
                f"{method} {path} {status_code} {duration*1000:.2f}ms",
                **log_data
            )
        else:
            # 本地环境：美化输出
            logger.info(
                f"[{trace_id}] {method} {path} → {status_code} ({duration*1000:.2f}ms)"
            )

    @staticmethod
    def log_signal(
        trace_id: str,
        signal_type: str,
        code: str,
        confidence: float,
        duration: float,
        agents: Optional[list] = None,
    ):
        """
        记录信号生成日志（用于复盘分析）
        """
        log_data = {
            "trace_id": trace_id,
            "event": "signal_generated",
            "signal_type": signal_type,
            "stock_code": code,
            "confidence": confidence,
            "duration_ms": round(duration * 1000, 2),
            "agents": agents or [],
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        logger.info(f"Signal: {signal_type} {code} confidence={confidence}", **log_data)

    @staticmethod
    def log_error(
        trace_id: str,
        error_type: str,
        error_msg: str,
        path: Optional[str] = None,
        stack_trace: Optional[str] = None,
    ):
        """
        记录错误日志
        """
        log_data = {
            "trace_id": trace_id,
            "event": "error",
            "error_type": error_type,
            "error_msg": error_msg,
            "path": path,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        if stack_trace:
            log_data["stack_trace"] = stack_trace

        logger.error(f"[{trace_id}] Error: {error_type} - {error_msg}", **log_data)


# 导出简化接口
request_logger = RequestLogger()


def get_logger(name: str = "app"):
    """
    获取命名日志记录器
    用于兼容标准 logging 风格的调用
    """
    return loguru_logger.bind(name=name)

"""
安全相关功能
- 登录失败锁定
- 审计日志
- Token 黑名单
- 安全头
"""

import hashlib
import json
import time
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from redis.asyncio import Redis
from app.core.config import settings
import ipaddress


# 创建 Redis 连接
redis_client: Optional[Redis] = None


def get_redis_client() -> Redis:
    """获取 Redis 客户端"""
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


class LoginProtection:
    """登录保护 - 防止暴力破解"""

    def __init__(self):
        self.redis = None

    async def _get_redis(self):
        if self.redis is None:
            self.redis = get_redis_client()
        return self.redis

    async def check_login_attempts(self, identifier: str, ip: str) -> tuple[bool, int]:
        """
        检查登录尝试次数
        返回: (是否允许登录, 剩余锁定秒数)
        """
        redis = await self._get_redis()

        # 基于账号的锁定
        account_key = f"login_lock:account:{identifier}"
        account_lock = await redis.get(account_key)
        if account_lock:
            ttl = await redis.ttl(account_key)
            return False, ttl

        # 基于 IP 的锁定
        ip_key = f"login_lock:ip:{ip}"
        ip_lock = await redis.get(ip_key)
        if ip_lock:
            ttl = await redis.ttl(ip_key)
            return False, ttl

        return True, 0

    async def record_failed_attempt(self, identifier: str, ip: str):
        """记录失败尝试"""
        redis = await self._get_redis()

        # 账号失败次数
        account_key = f"login_fail:account:{identifier}"
        account_fails = await redis.incr(account_key)
        await redis.expire(account_key, 3600)  # 1小时过期

        # IP 失败次数
        ip_key = f"login_fail:ip:{ip}"
        ip_fails = await redis.incr(ip_key)
        await redis.expire(ip_key, 3600)

        # 超过阈值则锁定
        if account_fails >= 5:
            lock_key = f"login_lock:account:{identifier}"
            await redis.setex(lock_key, 900, "locked")  # 锁定15分钟

        if ip_fails >= 10:
            lock_key = f"login_lock:ip:{ip}"
            await redis.setex(lock_key, 900, "locked")  # 锁定15分钟

    async def clear_attempts(self, identifier: str, ip: str):
        """清除失败记录（登录成功时调用）"""
        redis = await self._get_redis()
        await redis.delete(f"login_fail:account:{identifier}")
        await redis.delete(f"login_fail:ip:{ip}")

    async def get_attempts_status(self, identifier: str, ip: str) -> Dict[str, Any]:
        """获取尝试状态"""
        redis = await self._get_redis()

        account_fails = int(await redis.get(f"login_fail:account:{identifier}") or 0)
        ip_fails = int(await redis.get(f"login_fail:ip:{ip}") or 0)

        return {
            "account_fails": account_fails,
            "ip_fails": ip_fails,
            "account_remaining": max(0, 5 - account_fails),
            "ip_remaining": max(0, 10 - ip_fails),
        }


class AuditLogger:
    """审计日志 - 记录敏感操作"""

    SENSITIVE_ACTIONS = {
        "user_create": "创建用户",
        "user_update": "更新用户",
        "user_delete": "删除用户",
        "user_reset_password": "重置密码",
        "agent_update": "更新 Agent",
        "settings_update": "更新系统配置",
        "rebate_settle": "返佣结算",
        "login_success": "登录成功",
        "login_failed": "登录失败",
        "logout": "退出登录",
    }

    def __init__(self):
        self.redis = None

    async def _get_redis(self):
        if self.redis is None:
            self.redis = get_redis_client()
        return self.redis

    async def log(
        self,
        action: str,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        details: Optional[Dict] = None,
        request: Optional[Request] = None,
    ):
        """记录审计日志"""
        redis = await self._get_redis()

        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "action_name": self.SENSITIVE_ACTIONS.get(action, action),
            "user_id": user_id,
            "user_email": user_email,
            "details": details or {},
        }

        if request:
            log_entry["ip"] = self._get_client_ip(request)
            log_entry["user_agent"] = request.headers.get("user-agent", "")
            log_entry["request_id"] = request.headers.get("x-request-id", "")

        # 存储到 Redis 列表（保留最近10000条）
        key = f"audit_log:{action}"
        await redis.lpush(key, json.dumps(log_entry, ensure_ascii=False))
        await redis.ltrim(key, 0, 9999)

        # 存储到全局日志列表
        await redis.lpush("audit_log:all", json.dumps(log_entry, ensure_ascii=False))
        await redis.ltrim("audit_log:all", 0, 9999)

        # 按日期存储，便于归档
        date_key = datetime.utcnow().strftime("%Y-%m-%d")
        await redis.lpush(f"audit_log:{date_key}", json.dumps(log_entry, ensure_ascii=False))

    def _get_client_ip(self, request: Request) -> str:
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

    async def get_recent_logs(
        self, action: Optional[str] = None, limit: int = 100
    ) -> list:
        """获取最近日志"""
        redis = await self._get_redis()

        key = f"audit_log:{action}" if action else "audit_log:all"
        logs = await redis.lrange(key, 0, limit - 1)

        return [json.loads(log) for log in logs]


class TokenBlacklist:
    """Token 黑名单 - 用于登出后使 Token 失效"""

    def __init__(self):
        self.redis = None

    async def _get_redis(self):
        if self.redis is None:
            self.redis = get_redis_client()
        return self.redis

    async def add_to_blacklist(self, token: str, exp: int):
        """将 Token 加入黑名单"""
        redis = await self._get_redis()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        ttl = exp - int(time.time())
        if ttl > 0:
            await redis.setex(f"token_blacklist:{token_hash}", ttl, "revoked")

    async def is_blacklisted(self, token: str) -> bool:
        """检查 Token 是否在黑名单中"""
        redis = await self._get_redis()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return await redis.exists(f"token_blacklist:{token_hash}") > 0


class SecurityHeaders:
    """安全响应头管理"""

    @staticmethod
    def get_security_headers() -> Dict[str, str]:
        """获取安全响应头"""
        return {
            # 禁止 MIME 类型嗅探
            "X-Content-Type-Options": "nosniff",
            # XSS 保护（旧浏览器）
            "X-XSS-Protection": "1; mode=block",
            # 点击劫持保护
            "X-Frame-Options": "DENY",
            # Referrer 策略
            "Referrer-Policy": "strict-origin-when-cross-origin",
            # 权限策略
            "Permissions-Policy": (
                "accelerometer=(), "
                "camera=(), "
                "geolocation=(), "
                "gyroscope=(), "
                "magnetometer=(), "
                "microphone=(), "
                "payment=(), "
                "usb=()"
            ),
            # 内容安全策略（API 不需要太严格，因为返回的是 JSON）
            "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none';",
        }


class IPWhitelist:
    """IP 白名单检查"""

    def __init__(self):
        # 默认允许的私有网段
        self.whitelist = [
            ipaddress.ip_network("127.0.0.1/32"),
            ipaddress.ip_network("::1/128"),
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"),
        ]

    def add_ip(self, ip: str):
        """添加 IP 或网段到白名单"""
        try:
            if "/" in ip:
                self.whitelist.append(ipaddress.ip_network(ip))
            else:
                self.whitelist.append(ipaddress.ip_network(f"{ip}/32"))
        except ValueError:
            pass

    def is_allowed(self, ip: str) -> bool:
        """检查 IP 是否在白名单中"""
        try:
            ip_obj = ipaddress.ip_address(ip)
            return any(ip_obj in network for network in self.whitelist)
        except ValueError:
            return False


# 全局实例
login_protection = LoginProtection()
audit_logger = AuditLogger()
token_blacklist = TokenBlacklist()
ip_whitelist = IPWhitelist()


async def get_redis_client() -> Redis:
    """获取Redis客户端（异步）"""
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client

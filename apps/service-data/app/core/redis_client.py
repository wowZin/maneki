"""
Redis 缓存客户端
"""
import json
import pickle
from functools import wraps
from typing import Optional, Any, Callable
import redis.asyncio as redis
from loguru import logger

from app.core import settings


class RedisClient:
    """Redis 客户端封装"""
    
    _instance = None
    _client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self):
        """连接 Redis"""
        try:
            self._client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            logger.info("Redis connected")
        except Exception as e:
            logger.error(f"Failed to connect Redis: {e}")
            self._client = None
    
    async def close(self):
        """关闭连接"""
        if self._client:
            await self._client.close()
            logger.info("Redis disconnected")
    
    @property
    def client(self) -> Optional[redis.Redis]:
        return self._client
    
    async def get(self, key: str) -> Optional[str]:
        """获取字符串值"""
        if not self._client:
            return None
        try:
            return await self._client.get(key)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: str, ttl: int = None) -> bool:
        """设置字符串值"""
        if not self._client:
            return False
        try:
            await self._client.set(key, value, ex=ttl)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    async def get_json(self, key: str) -> Optional[Any]:
        """获取 JSON 数据"""
        data = await self.get(key)
        if data:
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return None
        return None
    
    async def set_json(self, key: str, value: Any, ttl: int = None) -> bool:
        """设置 JSON 数据"""
        return await self.set(key, json.dumps(value, ensure_ascii=False), ttl)
    
    async def delete(self, key: str) -> bool:
        """删除键"""
        if not self._client:
            return False
        try:
            await self._client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        if not self._client:
            return False
        try:
            return await self._client.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False


# 全局实例
redis_client = RedisClient()


def cached(ttl: int = 300, key_prefix: str = "cache"):
    """
    缓存装饰器
    
    Args:
        ttl: 缓存时间（秒）
        key_prefix: 缓存键前缀
    
    Usage:
        @cached(ttl=300, key_prefix="kline")
        async def get_kline_data(code: str, days: int):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{key_prefix}:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # 尝试从缓存获取
            cached_data = await redis_client.get_json(cache_key)
            if cached_data is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_data
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 写入缓存
            if result is not None:
                await redis_client.set_json(cache_key, result, ttl)
                logger.debug(f"Cache set: {cache_key}")
            
            return result
        
        return wrapper
    return decorator


def cache_key(pattern: str, **kwargs) -> str:
    """生成缓存键"""
    key = pattern
    for k, v in sorted(kwargs.items()):
        key = key.replace(f"{{{k}}}", str(v))
    return key

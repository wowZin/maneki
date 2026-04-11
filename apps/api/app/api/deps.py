"""
API 依赖注入
FastAPI 依赖
"""

from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db as get_db_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话"""
    async for session in get_db_session():
        yield session


# 可以添加其他依赖，如：
# - 当前用户
# - 权限验证
# - Redis 连接等

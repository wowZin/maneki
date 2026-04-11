"""
数据服务配置
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # 服务配置
    APP_NAME: str = "Maneki Data Service"
    APP_VERSION: str = "1.0.0"
    PORT: int = 8001

    # Tushare Pro 配置
    TUSHARE_TOKEN: str = ""
    TUSHARE_ENABLED: bool = False

    # 数据源策略: tushare | akshare | auto
    # auto: 优先使用 Tushare（如果配置了token），否则使用 Akshare
    DATA_SOURCE_STRATEGY: str = "auto"

    # 缓存配置
    CACHE_TTL: int = 300  # 5分钟

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()

"""
应用配置管理
使用 Pydantic Settings 管理环境变量
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # 应用信息
    APP_NAME: str = "Maneki API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # 数据库配置
    DATABASE_URL: str = "postgresql+asyncpg://stock:stock123@localhost:5432/stock_analysis"
    DATABASE_ECHO: bool = False

    # Redis 配置
    REDIS_URL: str = "redis://localhost:6379"

    # RabbitMQ 配置
    RABBITMQ_URL: str = "amqp://stock:stock123@localhost:5672/"

    # 监控配置
    MONITOR_STOCK_COUNT: int = 200  # 日关注股票数
    SIGNAL_THRESHOLD: float = 0.75  # 信号置信度阈值
    DATA_COLLECTION_INTERVAL: int = 5  # 数据采集间隔（秒）
    DATA_RETENTION_DAYS: int = 14  # 数据保留天数（TTL）
    REPLAY_TIME: str = "15:35"  # 每日复盘时间

    # Agent 配置
    AGENT_DISCUSSION_TIMEOUT: int = 5  # Agent讨论超时时间（秒）
    MAX_AGENTS: int = 5  # 最大Agent数量

    # 交易时间
    MORNING_START: str = "09:30"
    MORNING_END: str = "11:30"
    AFTERNOON_START: str = "13:00"
    AFTERNOON_END: str = "15:00"

    # CORS 配置
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


# 全局配置实例
settings = Settings()

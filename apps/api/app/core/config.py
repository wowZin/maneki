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
    DEBUG: bool = False

    # 安全密钥（生产环境必须从环境变量读取！）
    SECRET_KEY: str = ""  # 未设置时启动会报错

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

    # ========== 返佣配置 ==========
    # 自定义Agent订阅返佣配置
    AGENT_SUBSCRIPTION_REBATE_ENABLED: bool = True  # 是否启用返佣
    AGENT_SUBSCRIPTION_REBATE_AMOUNT: float = 10.0  # 单次订阅返佣金额（元）
    AGENT_SUBSCRIPTION_REBATE_MIN_VIP_DAYS: int = 30  # 触发返佣的最小VIP订阅天数（防止短期订阅套利）
    AGENT_SUBSCRIPTION_REBATE_SETTLEMENT_DAYS: int = 7  # 返佣结算周期（天），退款期过后才结算
    AGENT_SUBSCRIPTION_REBATE_MAX_PER_MONTH: float = 1000.0  # 单个Owner每月最大返佣金额

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

    # ========== 微信生态配置 ==========
    # 微信公众号（用于网页授权登录）
    WECHAT_MP_APP_ID: str = ""  # 公众号 AppID
    WECHAT_MP_APP_SECRET: str = ""  # 公众号 AppSecret

    # 微信小程序（用于小程序登录）
    WECHAT_MINI_APP_ID: str = ""  # 小程序 AppID
    WECHAT_MINI_APP_SECRET: str = ""  # 小程序 AppSecret

    # 微信开放平台（可选，用于 APP 登录）
    WECHAT_OPEN_APP_ID: str = ""
    WECHAT_OPEN_APP_SECRET: str = ""

    # ========== 安全配置 ==========
    # 登录失败锁定
    LOGIN_MAX_ATTEMPTS: int = 5  # 最大失败次数
    LOGIN_LOCK_DURATION: int = 900  # 锁定时间（秒）
    IP_MAX_ATTEMPTS: int = 10  # IP 最大失败次数

    # Token 配置
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # Access Token 过期时间（2小时）
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # Refresh Token 过期时间（7天）

    # Admin IP 白名单（逗号分隔）
    ADMIN_IP_WHITELIST: str = "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

    # 审计日志保留天数
    AUDIT_LOG_RETENTION_DAYS: int = 90

    # ========== 数据源配置 ==========
    # 免费数据源 (Akshare) - 默认数据源，无限制
    AKSHARE_ENABLED: bool = True

    # 付费数据源 (Tushare Pro) - VIP/SVIP 专享
    TUSHARE_TOKEN: str = ""  # Tushare Pro Token
    TUSHARE_ENABLED: bool = False  # 默认关闭，配置token后启用

    # 数据源使用策略
    # free: 所有用户使用 Akshare
    # tiered: 免费用户 Akshare, VIP/SVIP 使用 Tushare Pro
    DATA_SOURCE_STRATEGY: str = "tiered"

    # ========== LLM 配置 ==========
    # LLM 提供商: openai | aliyun | deepseek | local
    LLM_PROVIDER: str = "aliyun"

    # 阿里云 DashScope 配置
    ALIYUN_API_KEY: str = ""  # 从环境变量读取
    ALIYUN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # 默认模型
    LLM_MODEL: str = "qwen-turbo"

    # 高级模型（用于决策/复盘）
    LLM_MODEL_ADVANCED: str = "qwen-plus"


# 全局配置实例
settings = Settings()

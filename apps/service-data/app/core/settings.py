"""
Data Service Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Service
    SERVICE_NAME: str = "data-service"
    SERVICE_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    
    # Tushare Pro
    TUSHARE_TOKEN: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SHORT: int = 300      # 5 minutes for K-line
    CACHE_TTL_LONG: int = 14400     # 4 hours for news
    
    # Database
    DATABASE_URL: str = "postgresql://stock:stock123@timescaledb:5432/stock_analysis"

    # Storage
    OSS_ENDPOINT: Optional[str] = None
    OSS_ACCESS_KEY: Optional[str] = None
    OSS_SECRET_KEY: Optional[str] = None
    OSS_BUCKET: str = "maneki-data"
    LOCAL_STORAGE_PATH: str = "/data/offline"

    # Scheduler
    ENABLE_SCHEDULER: bool = True
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

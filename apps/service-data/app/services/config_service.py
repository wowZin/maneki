"""
配置服务
从 PostgreSQL 读取系统配置
"""
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

from app.db.database import get_db_session
from app.db.models import News


class ConfigService:
    """配置服务"""

    @staticmethod
    def get_news_sync_settings() -> Dict[str, Any]:
        """
        获取新闻同步设置

        从数据库读取，如果没有则返回默认值

        Returns:
            {
                "time_mode": "fixed" | "interval",
                "fixed_times": ["08:00", "12:00"],
                "interval_hours": 1,
                "sources": ["global_futu", "global_ths", "global_cls", "global_sina"]
            }
        """
        try:
            with get_db_session() as db:
                # 查询 settings 表
                # 注意：这里使用原始SQL，因为Go API创建的表结构可能不同
                try:
                    result = db.execute(
                        "SELECT value FROM settings WHERE type = 'news_sync' AND key = 'config'"
                    ).fetchone()

                    if result and result[0]:
                        settings = json.loads(result[0])
                        logger.info(f"Loaded news sync settings from DB: {settings}")
                        return settings
                except Exception as e:
                    logger.warning(f"Failed to load settings from DB: {e}")

        except Exception as e:
            logger.warning(f"Config service error: {e}")

        # 返回默认设置
        default_settings = {
            "time_mode": "interval",
            "interval_hours": 1,
            "fixed_times": ["08:00", "12:00", "15:30"],
            "sources": ["global_futu", "global_ths", "global_cls", "global_sina"]
        }
        logger.info(f"Using default news sync settings: {default_settings}")
        return default_settings

    @staticmethod
    def get_enabled_sources() -> List[str]:
        """
        获取启用的数据源列表

        Returns:
            数据源ID列表
        """
        settings = ConfigService.get_news_sync_settings()
        sources = settings.get("sources", [])

        if not sources:
            # 默认全部启用
            return ["global_futu", "global_ths", "global_cls", "global_sina"]

        return sources

    @staticmethod
    def should_use_source(source_id: str) -> bool:
        """
        检查是否应该使用某个数据源

        Args:
            source_id: 数据源ID

        Returns:
            是否启用
        """
        enabled_sources = ConfigService.get_enabled_sources()
        return source_id in enabled_sources

    @staticmethod
    def get_top_list_sync_settings() -> Dict[str, Any]:
        """
        获取龙虎榜同步设置

        只支持固定时间模式

        Returns:
            {
                "enabled": True,
                "fixed_times": ["15:30", "16:00", "17:00"]
            }
        """
        try:
            with get_db_session() as db:
                try:
                    result = db.execute(
                        "SELECT value FROM settings WHERE type = 'top_list_sync' AND key = 'config'"
                    ).fetchone()

                    if result and result[0]:
                        settings = json.loads(result[0])
                        logger.info(f"Loaded top list sync settings from DB: {settings}")
                        return settings
                except Exception as e:
                    logger.warning(f"Failed to load top list settings from DB: {e}")

        except Exception as e:
            logger.warning(f"Config service error: {e}")

        # 返回默认设置
        default_settings = {
            "enabled": True,
            "fixed_times": ["15:30", "16:00", "17:00"]
        }
        logger.info(f"Using default top list sync settings: {default_settings}")
        return default_settings

    @staticmethod
    def get_top_inst_sync_settings() -> Dict[str, Any]:
        """
        获取龙虎榜机构交易名单同步设置

        只支持固定时间模式

        Returns:
            {
                "enabled": True,
                "fixed_times": ["15:30", "16:00", "17:00"]
            }
        """
        try:
            with get_db_session() as db:
                try:
                    result = db.execute(
                        "SELECT value FROM settings WHERE type = 'top_inst_sync' AND key = 'config'"
                    ).fetchone()

                    if result and result[0]:
                        settings = json.loads(result[0])
                        logger.info(f"Loaded top inst sync settings from DB: {settings}")
                        return settings
                except Exception as e:
                    logger.warning(f"Failed to load top inst settings from DB: {e}")

        except Exception as e:
            logger.warning(f"Config service error: {e}")

        # 返回默认设置
        default_settings = {
            "enabled": True,
            "fixed_times": ["15:30", "16:00", "17:00"]
        }
        logger.info(f"Using default top inst sync settings: {default_settings}")
        return default_settings

    @staticmethod
    def get_hot_money_sync_settings() -> Dict[str, Any]:
        """
        获取游资名录同步设置

        只支持固定时间模式

        Returns:
            {
                "enabled": True,
                "fixed_times": ["06:00"]
            }
        """
        try:
            with get_db_session() as db:
                try:
                    result = db.execute(
                        "SELECT value FROM settings WHERE type = 'hot_money_sync' AND key = 'config'"
                    ).fetchone()

                    if result and result[0]:
                        settings = json.loads(result[0])
                        logger.info(f"Loaded hot money sync settings from DB: {settings}")
                        return settings
                except Exception as e:
                    logger.warning(f"Failed to load hot money settings from DB: {e}")

        except Exception as e:
            logger.warning(f"Config service error: {e}")

        # 返回默认设置
        default_settings = {
            "enabled": True,
            "fixed_times": ["06:00"]
        }
        logger.info(f"Using default hot money sync settings: {default_settings}")
        return default_settings

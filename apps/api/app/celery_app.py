"""
Celery 应用配置
用于异步任务和定时任务调度
"""

from celery import Celery
from app.core.config import settings

# 创建 Celery 应用
celery_app = Celery(
    "maneki",
    broker=settings.RABBITMQ_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.data_sync",
    ],
)

# Celery 配置
celery_app.conf.update(
    # 任务序列化
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,

    # 任务结果过期时间
    result_expires=3600,

    # 任务跟踪
    task_track_started=True,

    # 并发设置
    worker_prefetch_multiplier=1,

    # 定时任务调度
    beat_schedule={
        # 每日收盘后增量同步 (15:35)
        "daily-incremental-sync": {
            "task": "app.tasks.data_sync.daily_incremental_sync",
            "schedule": "crontab(hour=15, minute=35)",
        },

        # 数据完整性检查 (每小时)
        "data-completeness-check": {
            "task": "app.tasks.data_sync.check_data_completeness",
            "schedule": 3600.0,  # 每小时
        },

        # 清理过期数据 (每天凌晨2点)
        "cleanup-old-data": {
            "task": "app.tasks.data_sync.cleanup_old_data",
            "schedule": "crontab(hour=2, minute=0)",
        },
    },
)


@celery_app.task(bind=True)
def debug_task(self):
    """调试任务"""
    print(f"Request: {self.request!r}")
    return "OK"

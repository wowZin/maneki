"""
定时任务调度器

配置和管理所有定时任务
"""

from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# 创建Celery实例
celery_app = Celery(
    "maneki_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.dashboard_stats",
        "app.tasks.data_sync",
    ]
)

# Celery配置
celery_app.conf.update(
    # 序列化
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # 时区
    timezone="Asia/Shanghai",
    enable_utc=True,

    # 任务执行设置
    task_track_started=True,
    task_time_limit=3600,  # 1小时超时
    worker_prefetch_multiplier=1,

    # 结果过期时间
    result_expires=86400,  # 1天

    # 任务路由
    task_routes={
        "app.tasks.dashboard_stats.*": {"queue": "stats"},
        "app.tasks.data_sync.*": {"queue": "data"},
    },

    # 定时任务调度
    beat_schedule={
        # 每15分钟回填一次结果（交易时段）
        "backfill-results-15min": {
            "task": "app.tasks.dashboard_stats.backfill_results_task",
            "schedule": 900.0,  # 15分钟
            "options": {"queue": "stats"},
        },

        # 收盘后聚合当日统计（15:30执行）
        "aggregate-daily-stats": {
            "task": "app.tasks.dashboard_stats.aggregate_daily_stats_task",
            "schedule": crontab(hour=15, minute=30),
            "options": {"queue": "stats"},
        },

        # 聚合用户整体统计（16:00执行）
        "aggregate-user-stats": {
            "task": "app.tasks.dashboard_stats.aggregate_user_stats_task",
            "schedule": crontab(hour=16, minute=0),
            "options": {"queue": "stats"},
        },

        # 凌晨全量重新聚合（确保数据准确）
        "run-all-stats-tasks": {
            "task": "app.tasks.dashboard_stats.run_all_stats_tasks",
            "schedule": crontab(hour=2, minute=0),
            "options": {"queue": "stats"},
        },
    },
)


# 任务注册（便于手动触发）
@celery_app.task(bind=True, max_retries=3)
def aggregate_daily_stats_task(self):
    """聚合每日统计任务"""
    from app.tasks.dashboard_stats import aggregator
    from datetime import date, timedelta

    try:
        yesterday = date.today() - timedelta(days=1)
        return aggregator.aggregate_daily_stats(yesterday)
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def aggregate_user_stats_task(self):
    """聚合用户统计任务"""
    from app.tasks.dashboard_stats import aggregator
    from datetime import date, timedelta

    try:
        yesterday = date.today() - timedelta(days=1)
        return aggregator.aggregate_user_overall_stats(yesterday)
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def backfill_results_task(self):
    """回填结果任务"""
    from app.tasks.dashboard_stats import aggregator
    from datetime import date, timedelta

    try:
        return aggregator.backfill_results()
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@celery_app.task
def run_all_stats_tasks():
    """运行所有统计任务"""
    from app.tasks.dashboard_stats import run_all_stats_tasks as _run_all
    return _run_all()

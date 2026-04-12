"""
定时任务调度器

支持根据数据库配置动态调整同步策略
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
from loguru import logger
from datetime import datetime
import time

scheduler = None


def is_trading_day() -> bool:
    """检查今天是否为交易日（简化版）"""
    weekday = datetime.now().weekday()
    if weekday >= 5:  # 5=周六, 6=周日
        return False
    return True


def sync_news_task():
    """
    同步新闻数据任务

    根据数据库配置选择数据源和同步策略
    所有步骤允许失败，只记录日志不影响其他步骤
    """
    logger.info("Starting scheduled news sync...")

    # 读取配置
    from app.services.config_service import ConfigService
    settings = ConfigService.get_news_sync_settings()
    enabled_sources = settings.get("sources", [])

    date = datetime.now().strftime("%Y%m%d")
    all_news = []
    source_results = {}

    # 1. 抓取新闻（根据配置的数据源）
    try:
        from app.services.news_sources import NewsSourceManager
        manager = NewsSourceManager()

        # 获取启用的数据源
        if enabled_sources:
            # 只抓取启用的数据源
            for source_id in enabled_sources:
                if source_id in manager.sources:
                    try:
                        source = manager.sources[source_id]
                        raw_news = source.fetch_news()
                        normalized = source.normalize_news(raw_news)
                        deduped = manager._dedup_by_source(normalized, source_id)
                        source_results[source_id] = deduped
                        logger.info(f"Fetched {len(deduped)} news from {source_id}")
                    except Exception as e:
                        logger.warning(f"Failed to fetch from {source_id}: {e}")
                        source_results[source_id] = []

            # 合并所有新闻
            all_news = manager.merge_news(source_results)
        else:
            # 没有配置，抓取所有
            source_results = manager.fetch_all_news()
            all_news = manager.merge_news(source_results)

        logger.info(f"Fetched {len(all_news)} news items from {len(enabled_sources)} sources")
    except Exception as e:
        logger.warning(f"News fetching failed: {e}")
        all_news = []

    # 2. 获取情绪数据（允许失败）
    sentiment = {}
    try:
        from app.services.news_service import get_sentiment_data
        sentiment = get_sentiment_data(date)
        logger.info(f"Fetched sentiment data: {sentiment}")
    except Exception as e:
        logger.warning(f"Sentiment data fetch failed: {e}")
        sentiment = {}

    # 3. 获取板块情绪（允许失败）
    sector_sentiment = {}
    try:
        from app.services.news_service import get_sector_sentiment
        sector_sentiment = get_sector_sentiment()
    except Exception as e:
        logger.warning(f"Sector sentiment fetch failed: {e}")
        sector_sentiment = {}

    # 4. 保存到本地离线存储（允许失败）
    try:
        from app.services.news_service import save_to_offline_storage

        # 保存新闻
        if all_news:
            from app.services.news_sources import NewsSourceManager
            manager = NewsSourceManager()
            news_saved = save_to_offline_storage(
                {
                    "news": all_news,
                    "sync_time": datetime.now().isoformat(),
                    "count": len(all_news),
                    "by_source": manager.get_source_stats(source_results)
                },
                "news",
                date
            )
            logger.info(f"News saved to local storage: {news_saved}")

        # 保存情绪数据
        if sentiment:
            save_to_offline_storage(sentiment, "sentiment", date)

        # 保存板块情绪
        if sector_sentiment:
            save_to_offline_storage(sector_sentiment, "sector_sentiment", date)

    except Exception as e:
        logger.warning(f"Local storage save failed: {e}")

    # 5. 保存到 PostgreSQL（允许失败）
    try:
        from app.services.news_sync_service import save_news_to_db
        if all_news:
            inserted = save_news_to_db(all_news, date)
            logger.info(f"DB sync completed: inserted {inserted} news")
    except Exception as e:
        logger.warning(f"DB sync failed: {e}")

    # 6. 上传到 OSS（允许失败，异步）
    try:
        from app.services.oss_service import upload_to_oss
        from concurrent.futures import ThreadPoolExecutor
        from app.core import settings as app_settings
        import os

        def upload_to_oss_safe(date_str):
            try:
                # 上传新闻
                news_path = os.path.join(app_settings.LOCAL_STORAGE_PATH, "news", f"{date_str}.json")
                if os.path.exists(news_path):
                    upload_to_oss(news_path, f"news/{date_str}.json")

                # 上传情绪
                sentiment_path = os.path.join(app_settings.LOCAL_STORAGE_PATH, "sentiment", f"{date_str}.json")
                if os.path.exists(sentiment_path):
                    upload_to_oss(sentiment_path, f"sentiment/{date_str}.json")

                # 上传板块情绪
                sector_path = os.path.join(app_settings.LOCAL_STORAGE_PATH, "sector_sentiment", f"{date_str}.json")
                if os.path.exists(sector_path):
                    upload_to_oss(sector_path, f"sector_sentiment/{date_str}.json")

                logger.info(f"OSS upload completed for {date_str}")
            except Exception as e:
                logger.warning(f"OSS upload failed for {date_str}: {e}")

        executor = ThreadPoolExecutor(max_workers=2)
        executor.submit(upload_to_oss_safe, date)
        logger.info("OSS upload task submitted")
    except Exception as e:
        logger.warning(f"OSS upload task submission failed: {e}")

    logger.info("News sync task completed")


def sync_kline_task():
    """收盘后批量同步 K线数据任务"""
    if not is_trading_day():
        logger.info("Today is not a trading day, skip kline sync")
        return

    logger.info("Starting scheduled kline sync...")

    try:
        from app.services.sync_service import sync_all_kline

        # 同步最近 30 天的 K线数据
        result = sync_all_kline(days=30)

        logger.info(
            f"Kline sync completed: total={result['total']}, "
            f"success={result['success']}, failed={result['failed']}"
        )

    except Exception as e:
        logger.error(f"Kline sync failed: {e}")


def reload_news_sync_jobs():
    """
    重新加载新闻同步任务

    根据数据库配置重新配置调度任务
    """
    global scheduler

    if not scheduler:
        logger.warning("Scheduler not initialized, cannot reload jobs")
        return

    try:
        from app.services.config_service import ConfigService
        settings = ConfigService.get_news_sync_settings()

        time_mode = settings.get("time_mode", "interval")

        # 移除旧的同步任务
        try:
            scheduler.remove_job("news_sync")
        except:
            pass

        if time_mode == "interval":
            # 间隔模式
            hours = settings.get("interval_hours", 1)
            scheduler.add_job(
                sync_news_task,
                trigger=IntervalTrigger(hours=hours),
                id="news_sync",
                name=f"News Sync (every {hours} hours)",
                replace_existing=True
            )
            logger.info(f"News sync job configured: every {hours} hours")

        elif time_mode == "fixed":
            # 固定时间模式
            fixed_times = settings.get("fixed_times", ["08:00", "12:00", "15:30"])

            for i, time_str in enumerate(fixed_times):
                try:
                    hour, minute = map(int, time_str.split(":"))
                    scheduler.add_job(
                        sync_news_task,
                        trigger=CronTrigger(hour=hour, minute=minute),
                        id=f"news_sync_{i}",
                        name=f"News Sync at {time_str}",
                        replace_existing=True
                    )
                    logger.info(f"News sync job configured: {time_str}")
                except Exception as e:
                    logger.error(f"Failed to add job for {time_str}: {e}")

    except Exception as e:
        logger.error(f"Failed to reload news sync jobs: {e}")


def start_scheduler():
    """启动定时任务调度器"""
    global scheduler

    scheduler = BackgroundScheduler()

    # 首先根据配置添加新闻同步任务
    reload_news_sync_jobs()

    # K线同步 - 收盘后 15:30
    scheduler.add_job(
        sync_kline_task,
        trigger=CronTrigger(hour=15, minute=30),
        id="kline_sync_close",
        name="KLine Sync After Close",
        replace_existing=True
    )

    # 添加配置刷新任务（每5分钟检查一次配置是否有变化）
    scheduler.add_job(
        reload_news_sync_jobs,
        trigger=IntervalTrigger(minutes=5),
        id="config_reload",
        name="Reload Config",
        replace_existing=True
    )

    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    """停止定时任务调度器"""
    global scheduler

    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler stopped")

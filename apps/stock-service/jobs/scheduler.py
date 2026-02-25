"""Scheduler for daily Market Watch pipeline.

Runs after Vietnam market close (3:30 PM ICT / UTC+7).
Pipeline: daily_scan → news_fetch → deep_research → digest
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from jobs.daily_scan import run_daily_scan
from jobs.deep_research import run_deep_research
from jobs.digest import run_digest
from jobs.news_fetch import run_news_fetch


def start_scheduler():
    scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")

    # Step 1: Scan for undervalued stocks at 3:30 PM
    scheduler.add_job(run_daily_scan, "cron", hour=15, minute=30, id="daily_scan")

    # Step 2: Fetch news for candidates at 3:45 PM
    scheduler.add_job(run_news_fetch, "cron", hour=15, minute=45, id="news_fetch")

    # Step 3: Deep research on top picks at 4:00 PM
    scheduler.add_job(run_deep_research, "cron", hour=16, minute=0, id="deep_research")

    # Step 4: Build and deliver daily digest at 4:30 PM
    scheduler.add_job(run_digest, "cron", hour=16, minute=30, id="digest")

    scheduler.start()
    return scheduler

"""Scheduler for Market Watch pipeline.

Runs every 6 hours to keep digest fresh.
Pipeline: daily_scan → news_fetch → deep_research → digest → save to DB
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from jobs.digest import run_and_persist


def start_scheduler():
    scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")

    scheduler.add_job(
        run_and_persist,
        "interval",
        hours=6,
        id="market_watch_digest",
        name="Market Watch Digest Pipeline",
    )

    scheduler.start()
    print("[Scheduler] Started — Market Watch digest every 6 hours")
    return scheduler

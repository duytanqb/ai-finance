"""Scheduler for Market Watch pipeline, YouTube digest, price alerts, and watchlist MA50 checks.

- Market Watch digest: every 6 hours
- YouTube digest: daily at 06:00 VN time
- Price alert check: every 30 minutes during market hours (Mon-Fri 9:00-15:00 VN time)
- Watchlist MA50 signal check: daily at 11:00 VN time (Mon-Fri)
"""

import os

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from jobs.digest import run_and_persist
from jobs.watchlist_review import check_watchlist_signals
from jobs.youtube_digest import run_youtube_digest

APP_URL = os.getenv("APP_URL", "http://localhost:3000")


async def check_price_alerts() -> None:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(f"{APP_URL}/api/alerts/check")
            if res.status_code == 200:
                data = res.json()
                created = data.get("alertsCreated", 0)
                if created > 0:
                    print(f"[AlertCheck] Created {created} new alert(s)")
            else:
                print(f"[AlertCheck] Failed with status {res.status_code}")
    except Exception as e:
        print(f"[AlertCheck] Error: {e}")


def start_scheduler():
    scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")

    scheduler.add_job(
        run_and_persist,
        "interval",
        hours=6,
        id="market_watch_digest",
        name="Market Watch Digest Pipeline",
    )

    scheduler.add_job(
        check_price_alerts,
        "cron",
        day_of_week="mon-fri",
        hour="9-14",
        minute="*/30",
        id="price_alert_check",
        name="Price Alert Check",
    )

    scheduler.add_job(
        run_youtube_digest,
        "cron",
        hour=6,
        minute=0,
        id="youtube_digest",
        name="YouTube Market Digest",
    )

    scheduler.add_job(
        check_watchlist_signals,
        "cron",
        day_of_week="mon-fri",
        hour=11,
        minute=0,
        id="watchlist_ma50_check",
        name="Watchlist MA50 Signal Check",
    )

    scheduler.start()
    print("[Scheduler] Started — Market Watch every 6h, YouTube digest at 06:00, Alert check every 30m, Watchlist MA50 at 11:00 (market days)")
    return scheduler

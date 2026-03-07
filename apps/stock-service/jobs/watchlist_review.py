"""Daily watchlist MA50 signal check — runs at 11:00 AM VN time."""

import logging
import os

import httpx

from services.ai_workflows import AIWorkflowService
from services.cache import CacheService

logger = logging.getLogger(__name__)

APP_URL = os.environ.get("APP_URL", "http://localhost:3000")

cache = CacheService()

TTL_SIGNAL = 86400  # 24 hours


async def check_watchlist_signals() -> None:
    """Fetch all watchlist symbols, compute MA50 signals, cache & persist results."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{APP_URL}/api/watchlist/symbols")
            if resp.status_code != 200:
                logger.warning("[WatchlistReview] Failed to fetch symbols: %d", resp.status_code)
                return
            data = resp.json()
            symbols = data.get("symbols", [])

        if not symbols:
            logger.info("[WatchlistReview] No watchlist symbols found")
            return

        logger.info("[WatchlistReview] Checking MA50 for %d symbols", len(symbols))

        ai = AIWorkflowService()
        result = await ai.watchlist_review(symbols)

        results = result.get("results", [])
        for stock in results:
            symbol = stock.get("symbol", "")
            if symbol:
                cache.set(f"watchlist:signal:{symbol}", stock, TTL_SIGNAL)

        # Save to DB via Next.js callback
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                f"{APP_URL}/api/watchlist/signals",
                json={"results": results},
            )

        logger.info("[WatchlistReview] Saved signals for %d stocks", len(results))

    except Exception as e:
        logger.error("[WatchlistReview] Failed: %s", e)

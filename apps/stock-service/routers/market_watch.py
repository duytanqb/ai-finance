"""Market Watch router — daily digest + market news endpoints."""

import asyncio
import threading
from datetime import datetime

from fastapi import APIRouter, Query

router = APIRouter()

_pipeline_thread: threading.Thread | None = None
_pipeline_started_at: str | None = None
_pipeline_error: str | None = None
_pipeline_done: bool = False


def _is_pipeline_running() -> bool:
    return _pipeline_thread is not None and _pipeline_thread.is_alive()


@router.post("/digest")
async def trigger_digest():
    """Trigger pipeline as background thread. Returns immediately.

    Poll GET /status for results.
    """
    global _pipeline_thread, _pipeline_started_at, _pipeline_error, _pipeline_done

    if _is_pipeline_running():
        return {"status": "running", "started_at": _pipeline_started_at}

    _pipeline_started_at = datetime.now().isoformat()
    _pipeline_error = None
    _pipeline_done = False
    _pipeline_thread = threading.Thread(target=_run_pipeline_sync, daemon=True)
    _pipeline_thread.start()
    return {"status": "started", "started_at": _pipeline_started_at}


def _run_pipeline_sync():
    """Run the full digest pipeline in a separate thread (non-blocking)."""
    global _pipeline_error, _pipeline_done
    try:
        import asyncio as _asyncio
        loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(loop)
        try:
            from jobs.digest import run_and_persist
            loop.run_until_complete(run_and_persist())
        finally:
            loop.close()
        _pipeline_done = True
        print("[MarketWatch] Background pipeline completed")
    except Exception as e:
        _pipeline_error = str(e)
        _pipeline_done = True
        print(f"[MarketWatch] Background pipeline failed: {e}")


@router.get("/digest")
async def get_digest():
    """Generate a fresh market digest by running the full pipeline.

    Legacy sync endpoint — prefer POST /digest + GET /status instead.
    """
    from jobs.digest import run_and_persist

    try:
        digest = await run_and_persist()
        return digest
    except Exception as e:
        from jobs.digest import get_latest_digest

        cached = get_latest_digest()
        if cached:
            return {**cached, "cached": True, "error": str(e)}
        return {"error": f"Failed to generate digest: {e}", "top_picks": []}


@router.get("/status")
async def get_pipeline_status():
    """Check pipeline status and get latest result."""
    from jobs.digest import get_latest_digest as _get_latest

    if _is_pipeline_running():
        return {
            "status": "running",
            "started_at": _pipeline_started_at,
        }

    if _pipeline_done and _pipeline_error:
        return {
            "status": "error",
            "error": _pipeline_error,
            "started_at": _pipeline_started_at,
        }

    cached = _get_latest()
    if cached:
        return {
            "status": "completed",
            "digest": cached,
            "started_at": _pipeline_started_at,
        }

    return {"status": "idle"}


@router.get("/latest")
async def get_latest():
    """Get the most recently generated digest without re-running pipeline."""
    from jobs.digest import get_latest_digest as _get_latest

    cached = _get_latest()
    if cached:
        return cached
    return {
        "error": "No digest available yet. Call POST /digest to generate one.",
        "top_picks": [],
    }


@router.get("/news")
async def get_market_news(limit: int = Query(default=20, ge=1, le=50)):
    """Get latest market news headlines (last 30 days)."""
    from services.news_crawler import NewsCrawler

    crawler = NewsCrawler()
    try:
        articles = await crawler.crawl_market_news(limit=limit)
        return {"articles": articles, "count": len(articles)}
    except Exception as e:
        return {"articles": [], "count": 0, "error": str(e)}

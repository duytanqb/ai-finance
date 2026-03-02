"""Market Watch router — daily digest + market news endpoints."""

import asyncio
import threading
import time
from datetime import datetime

from fastapi import APIRouter, Query

router = APIRouter()

_pipeline_thread: threading.Thread | None = None

_pipeline_state: dict = {
    "status": "idle",
    "started_at": None,
    "error": None,
    "current_stage": 0,
    "current_stage_name": "",
    "stage_detail": "",
    "stages": [],
}


def _is_pipeline_running() -> bool:
    return _pipeline_thread is not None and _pipeline_thread.is_alive()


def update_progress(stage: int, name: str, detail: str = "") -> None:
    _pipeline_state["current_stage"] = stage
    _pipeline_state["current_stage_name"] = name
    _pipeline_state["stage_detail"] = detail


def complete_stage(stage: int, name: str, result: str = "") -> None:
    stage_entry = next(
        (s for s in _pipeline_state["stages"] if s["stage"] == stage), None
    )
    if stage_entry:
        stage_entry["result"] = result
        stage_entry["completed_at"] = time.time()
        stage_entry["duration"] = round(
            stage_entry["completed_at"] - stage_entry["started_at"], 1
        )
    else:
        now = time.time()
        _pipeline_state["stages"].append({
            "stage": stage,
            "name": name,
            "result": result,
            "started_at": now,
            "completed_at": now,
            "duration": 0,
        })
    _pipeline_state["stage_detail"] = ""


def _start_stage(stage: int, name: str) -> None:
    update_progress(stage, name)
    existing = next(
        (s for s in _pipeline_state["stages"] if s["stage"] == stage), None
    )
    if not existing:
        _pipeline_state["stages"].append({
            "stage": stage,
            "name": name,
            "result": "",
            "started_at": time.time(),
            "completed_at": None,
            "duration": None,
        })


@router.post("/digest")
async def trigger_digest():
    """Trigger pipeline as background thread. Returns immediately.

    Poll GET /status for results.
    """
    global _pipeline_thread

    if _is_pipeline_running():
        return {"status": "running", "started_at": _pipeline_state["started_at"]}

    _pipeline_state["status"] = "running"
    _pipeline_state["started_at"] = datetime.now().isoformat()
    _pipeline_state["error"] = None
    _pipeline_state["current_stage"] = 0
    _pipeline_state["current_stage_name"] = ""
    _pipeline_state["stage_detail"] = ""
    _pipeline_state["stages"] = []
    _pipeline_thread = threading.Thread(target=_run_pipeline_sync, daemon=True)
    _pipeline_thread.start()
    return {"status": "started", "started_at": _pipeline_state["started_at"]}


def _run_pipeline_sync():
    """Run the full digest pipeline in a separate thread (non-blocking)."""
    try:
        import asyncio as _asyncio
        loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(loop)
        try:
            from jobs.digest import run_and_persist
            loop.run_until_complete(run_and_persist())
        finally:
            loop.close()
        _pipeline_state["status"] = "completed"
        print("[MarketWatch] Background pipeline completed")
    except Exception as e:
        _pipeline_state["status"] = "error"
        _pipeline_state["error"] = str(e)
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

    status = _pipeline_state["status"]

    if _is_pipeline_running() or status == "running":
        return {
            "status": "running",
            "started_at": _pipeline_state["started_at"],
            "current_stage": _pipeline_state["current_stage"],
            "current_stage_name": _pipeline_state["current_stage_name"],
            "stage_detail": _pipeline_state["stage_detail"],
            "stages": _pipeline_state["stages"],
        }

    if status == "error":
        return {
            "status": "error",
            "error": _pipeline_state["error"],
            "started_at": _pipeline_state["started_at"],
            "stages": _pipeline_state["stages"],
        }

    if status == "completed":
        cached = _get_latest()
        if cached:
            return {
                "status": "completed",
                "digest": cached,
                "started_at": _pipeline_state["started_at"],
                "stages": _pipeline_state["stages"],
            }

    cached = _get_latest()
    if cached:
        return {
            "status": "completed",
            "digest": cached,
            "started_at": _pipeline_state["started_at"],
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

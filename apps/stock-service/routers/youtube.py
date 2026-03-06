"""YouTube digest router — channel monitoring + AI summaries."""

import threading
import time
import asyncio
from datetime import datetime

from fastapi import APIRouter

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


def _start_stage(stage: int, name: str) -> None:
    _pipeline_state["stages"].append({
        "stage": stage,
        "name": name,
        "result": "",
        "started_at": time.time(),
        "completed_at": None,
        "duration": None,
    })


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


def set_pipeline_status(status: str, error: str | None = None) -> None:
    _pipeline_state["status"] = status
    _pipeline_state["error"] = error
    if status == "running":
        _pipeline_state["started_at"] = time.time()
        _pipeline_state["stages"] = []
        _pipeline_state["current_stage"] = 0


@router.post("/digest")
async def trigger_youtube_digest(body: dict | None = None):
    """Trigger YouTube digest pipeline manually."""
    global _pipeline_thread

    if _is_pipeline_running():
        return {"status": "already_running"}

    since_hours = 48
    if body and "since_hours" in body:
        since_hours = int(body["since_hours"])

    def _run_sync(hours: int):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            from jobs.youtube_digest import run_youtube_digest
            loop.run_until_complete(run_youtube_digest(since_hours=hours))
        finally:
            loop.close()

    _pipeline_thread = threading.Thread(target=_run_sync, args=(since_hours,), daemon=True)
    _pipeline_thread.start()

    return {"status": "started", "since_hours": since_hours}


@router.get("/digest")
async def get_latest_digest():
    """Get latest YouTube digest (from Python cache or signal to fetch from DB)."""
    return {"status": "ok", "message": "Fetch from Next.js API route instead"}


@router.get("/status")
async def get_pipeline_status():
    """Get YouTube pipeline progress for polling."""
    return {
        "pipeline_status": _pipeline_state["status"],
        "current_stage": _pipeline_state["current_stage"],
        "current_stage_name": _pipeline_state["current_stage_name"],
        "stage_detail": _pipeline_state["stage_detail"],
        "stages": _pipeline_state["stages"],
        "error": _pipeline_state["error"],
    }


@router.get("/channels")
async def list_channels():
    """List configured YouTube channels."""
    from services.youtube_crawler import CHANNELS
    return {"channels": CHANNELS}

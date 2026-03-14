"""Stock suggestions router — AI-powered buy recommendations from multiple sources."""

import asyncio
import threading
import time
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


def set_pipeline_status(status: str, error: str | None = None) -> None:
    _pipeline_state["status"] = status
    _pipeline_state["error"] = error
    if status == "running":
        _pipeline_state["started_at"] = time.time()
        _pipeline_state["stages"] = []
        _pipeline_state["current_stage"] = 0


@router.post("/run")
async def trigger_suggestions():
    global _pipeline_thread

    if _is_pipeline_running():
        return {"status": "already_running"}

    def _run_sync():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            from jobs.stock_suggestions import run_stock_suggestions
            loop.run_until_complete(run_stock_suggestions())
        finally:
            loop.close()

    set_pipeline_status("running")
    _pipeline_thread = threading.Thread(target=_run_sync, daemon=True)
    _pipeline_thread.start()
    return {"status": "started"}


@router.get("/status")
async def get_status():
    return {
        "pipeline_status": _pipeline_state["status"],
        "current_stage": _pipeline_state["current_stage"],
        "current_stage_name": _pipeline_state["current_stage_name"],
        "stage_detail": _pipeline_state["stage_detail"],
        "stages": _pipeline_state["stages"],
        "error": _pipeline_state["error"],
    }

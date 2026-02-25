"""Market Watch router - daily digest endpoint."""

from fastapi import APIRouter

router = APIRouter()

# Cache the latest digest in memory for quick retrieval
_latest_digest: dict | None = None


@router.get("/digest")
async def get_digest():
    """Get or generate the daily market digest.

    Runs the full pipeline on demand (scan → news → research → digest).
    In production, this would be triggered by the scheduler.
    """
    global _latest_digest

    from jobs.digest import run_daily_digest

    try:
        digest = await run_daily_digest()
        _latest_digest = digest
        return digest
    except Exception as e:
        # Return cached digest if available, otherwise error
        if _latest_digest:
            return {**_latest_digest, "cached": True, "error": str(e)}
        return {"error": f"Failed to generate digest: {e}", "top_picks": []}


@router.get("/latest")
async def get_latest_digest():
    """Get the most recently generated digest without re-running pipeline."""
    if _latest_digest:
        return _latest_digest
    return {"error": "No digest available yet. Call GET /digest to generate one.", "top_picks": []}

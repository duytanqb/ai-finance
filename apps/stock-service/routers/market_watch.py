"""Market Watch router — daily digest endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/digest")
async def get_digest():
    """Generate a fresh market digest by running the full pipeline.

    Pipeline: scan → news → research → digest → save to DB.
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


@router.get("/latest")
async def get_latest_digest():
    """Get the most recently generated digest without re-running pipeline."""
    from jobs.digest import get_latest_digest

    cached = get_latest_digest()
    if cached:
        return cached
    return {
        "error": "No digest available yet. Call GET /digest to generate one.",
        "top_picks": [],
    }

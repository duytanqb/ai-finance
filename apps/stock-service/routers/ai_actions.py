import asyncio
import json
import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from services.ai_workflows import AIWorkflowService
from services.cache import CacheService

router = APIRouter()

_cache = CacheService()


def _get_ai_service() -> AIWorkflowService:
    return AIWorkflowService()


async def _run_deep_research_bg(symbol: str) -> None:
    """Run deep research in background and save result via callback to Next.js."""
    try:
        service = _get_ai_service()
        sections: list[dict] = []
        async for chunk in service.deep_research_stream(symbol):
            if chunk.get("status") == "completed" and chunk.get("content"):
                sections.append(chunk)

        if not sections:
            print(f"[BG Deep Research] {symbol}: no sections produced")
            return

        report_text = "\n\n---\n\n".join(
            f"## {s['title']}\n\n{s['content']}" for s in sections
        )
        result = {
            "report": report_text,
            "sections": [
                {
                    "section": s["section"],
                    "title": s["title"],
                    "content": s["content"],
                    "status": "completed",
                }
                for s in sections
            ],
        }

        app_url = os.environ.get("APP_URL", "http://localhost:3000")
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{app_url}/api/reports",
                json={
                    "symbol": symbol.upper(),
                    "reportType": "deep_research",
                    "result": result,
                    "model": "sonnet",
                },
            )
        print(f"[BG Deep Research] {symbol}: saved to DB")
    except Exception as e:
        print(f"[BG Deep Research] {symbol} failed: {e}")


@router.post("/analyze/{symbol}")
async def analyze_stock(symbol: str):
    """Trigger full stock analysis workflow: price + financials + news → AI summary."""
    try:
        result = await _get_ai_service().analyze_stock(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deep-research/{symbol}")
async def deep_research(symbol: str):
    """Stream deep research report as SSE with 4 sections."""
    async def generate():
        try:
            service = _get_ai_service()
            async for section in service.deep_research_stream(symbol):
                yield f"data: {json.dumps(section)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/compare")
async def compare_stocks(symbols: list[str]):
    """Compare 2-3 stocks side by side."""
    if len(symbols) < 2 or len(symbols) > 3:
        raise HTTPException(status_code=400, detail="Provide 2-3 symbols to compare")
    try:
        result = await _get_ai_service().compare_stocks(symbols)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deep-research-bg/{symbol}")
async def deep_research_background(symbol: str):
    """Trigger deep research in background — saves result to DB via callback."""
    asyncio.create_task(_run_deep_research_bg(symbol.upper()))
    return {"status": "started", "symbol": symbol.upper()}


@router.post("/portfolio-review")
async def portfolio_review(holdings: list[dict]):
    """AI review of portfolio holdings with hold/sell/add suggestions."""
    try:
        result = await _get_ai_service().portfolio_review(holdings)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watchlist-review")
async def watchlist_review(body: dict):
    """AI review of watchlist stocks with MA50 signal analysis."""
    symbols = body.get("symbols", [])
    if not symbols:
        raise HTTPException(status_code=400, detail="symbols required")
    try:
        result = await _get_ai_service().watchlist_review(symbols)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlist-signals")
async def get_watchlist_signals():
    """Get cached MA50 signals for all watchlist stocks."""
    from services.cache import CacheService
    cache = CacheService()
    keys = cache.keys("watchlist:signal:*")
    signals = {}
    for key in keys:
        symbol = key.replace("watchlist:signal:", "")
        data = cache.get(key)
        if data:
            signals[symbol] = data
    return {"signals": signals}


@router.post("/watchlist-signals")
async def save_watchlist_signals(body: dict):
    """Save MA50 signals to cache (called by cron job)."""
    from services.cache import CacheService
    cache = CacheService()
    results = body.get("results", [])
    for stock in results:
        symbol = stock.get("symbol", "")
        if symbol:
            cache.set(f"watchlist:signal:{symbol}", stock, 86400)
    return {"ok": True, "count": len(results)}

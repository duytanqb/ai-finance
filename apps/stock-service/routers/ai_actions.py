import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from services.ai_workflows import AIWorkflowService

router = APIRouter()


def _get_ai_service() -> AIWorkflowService:
    return AIWorkflowService()


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


@router.post("/portfolio-review")
async def portfolio_review(holdings: list[dict]):
    """AI review of portfolio holdings with hold/sell/add suggestions."""
    try:
        result = await _get_ai_service().portfolio_review(holdings)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

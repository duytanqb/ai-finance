from fastapi import APIRouter, HTTPException

from services.ai_workflows import AIWorkflowService

router = APIRouter()
ai_service = AIWorkflowService()


@router.post("/analyze/{symbol}")
async def analyze_stock(symbol: str):
    """Trigger full stock analysis workflow: price + financials + news → AI summary."""
    try:
        result = await ai_service.analyze_stock(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deep-research/{symbol}")
async def deep_research(symbol: str):
    """Trigger deep research report (Claude Opus)."""
    try:
        result = await ai_service.deep_research(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
async def compare_stocks(symbols: list[str]):
    """Compare 2-3 stocks side by side."""
    if len(symbols) < 2 or len(symbols) > 3:
        raise HTTPException(status_code=400, detail="Provide 2-3 symbols to compare")
    try:
        result = await ai_service.compare_stocks(symbols)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolio-review")
async def portfolio_review(holdings: list[dict]):
    """AI review of portfolio holdings with hold/sell/add suggestions."""
    try:
        result = await ai_service.portfolio_review(holdings)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

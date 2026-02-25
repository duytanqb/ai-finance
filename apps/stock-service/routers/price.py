from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()


@router.get("/{symbol}/history")
async def get_price_history(
    symbol: str,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    interval: str = Query("1D", description="Interval: 1D, 1W, 1M"),
):
    try:
        data = client.get_price_history(symbol, start, end, interval)
        return {"symbol": symbol, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/board")
async def get_price_board(
    symbols: str = Query(..., description="Comma-separated symbols"),
):
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(",")]
        data = client.get_price_board(symbol_list)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

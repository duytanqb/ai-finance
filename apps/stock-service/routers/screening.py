from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()


@router.get("/scan")
async def screen_stocks(
    exchange: str = Query("HOSE", description="Exchange: HOSE, HNX, UPCOM"),
    max_pe: Optional[float] = Query(None, description="Max P/E ratio"),
    min_roe: Optional[float] = Query(None, description="Min ROE %"),
    min_market_cap: Optional[float] = Query(None, description="Min market cap (billion VND)"),
    max_price: Optional[float] = Query(None, description="Max stock price"),
):
    try:
        filters = {
            "exchange": exchange,
            "max_pe": max_pe,
            "min_roe": min_roe,
            "min_market_cap": min_market_cap,
            "max_price": max_price,
        }
        data = client.screen_stocks(filters)
        return {"filters": filters, "count": len(data), "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()


@router.get("/scan")
async def screen_stocks(
    exchange: str = Query("HOSE", description="Exchange: HOSE, HNX, UPCOM"),
    min_pe: Optional[float] = Query(None, description="Min P/E ratio"),
    max_pe: Optional[float] = Query(None, description="Max P/E ratio"),
    min_pb: Optional[float] = Query(None, description="Min P/B ratio"),
    max_pb: Optional[float] = Query(None, description="Max P/B ratio"),
    min_roe: Optional[float] = Query(None, description="Min ROE (e.g. 0.15 for 15%)"),
    min_market_cap: Optional[float] = Query(None, description="Min market cap (billion VND)"),
    min_dividend_yield: Optional[float] = Query(None, description="Min dividend yield (e.g. 0.03 for 3%)"),
    max_price: Optional[float] = Query(None, description="Max stock price (VND)"),
    limit: int = Query(50, description="Max symbols to scan (default 50, max 200)"),
):
    try:
        filters = {
            "exchange": exchange,
            "min_pe": min_pe,
            "max_pe": max_pe,
            "min_pb": min_pb,
            "max_pb": max_pb,
            "min_roe": min_roe,
            "min_market_cap": min_market_cap,
            "min_dividend_yield": min_dividend_yield,
            "max_price": max_price,
        }
        max_scan = min(limit, 200)
        data = client.screen_stocks(filters, max_scan=max_scan)
        return {"filters": filters, "count": len(data), "scanned_limit": max_scan, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

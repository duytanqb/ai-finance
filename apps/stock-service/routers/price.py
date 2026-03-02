from fastapi import APIRouter, HTTPException, Query

from services.dnse_client import DnseClient
from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()
dnse = DnseClient()


@router.get("/history/{symbol}")
@router.get("/{symbol}/history")
async def get_price_history(
    symbol: str,
    start: str = Query(None, description="Start date YYYY-MM-DD (vci source)"),
    end: str = Query(None, description="End date YYYY-MM-DD (vci source)"),
    interval: str = Query("1D", description="Interval: 1D, 1W, 1M"),
    source: str = Query("dnse", description="Data source: dnse or vci"),
    from_ts: int = Query(None, description="Start unix timestamp (dnse source)"),
    to_ts: int = Query(None, description="End unix timestamp (dnse source)"),
):
    try:
        if source == "dnse":
            resolution_map = {"1D": "1D", "1W": "1W", "1M": "1W"}
            resolution = resolution_map.get(interval, interval)
            data = await dnse.get_ohlc(
                symbol, resolution=resolution, from_ts=from_ts, to_ts=to_ts
            )
            return {"symbol": symbol.upper(), "data": data, "source": "dnse"}
        else:
            if not start or not end:
                raise HTTPException(
                    status_code=400,
                    detail="start and end params required for vci source",
                )
            data = client.get_price_history(symbol, start, end, interval)
            return {"symbol": symbol.upper(), "data": data, "source": "vci"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index/{symbol}/history")
async def get_index_history(
    symbol: str = "VNINDEX",
    resolution: str = Query("1D", description="Resolution: 1, 5, 15, 30, 1H, 1D, 1W"),
    from_ts: int = Query(None, description="Start unix timestamp"),
    to_ts: int = Query(None, description="End unix timestamp"),
):
    try:
        data = await dnse.get_index_ohlc(
            symbol, resolution=resolution, from_ts=from_ts, to_ts=to_ts
        )
        return {"symbol": symbol.upper(), "data": data, "source": "dnse"}
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

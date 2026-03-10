import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.ai_workflows import _compute_technical_signals
from services.dnse_client import DnseClient
from services.vnstock_client import VnstockClient

logger = logging.getLogger(__name__)

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


@router.get("/top-stocks")
async def get_top_stocks(
    count: int = Query(10, ge=1, le=30, description="Number of top stocks to return"),
):
    try:
        data = client.get_top_stocks(count)
        return {"data": data}
    except Exception as e:
        logger.warning("VCI top-stocks failed: %s, using DNSE fallback", e)
        try:
            data = await _top_stocks_from_dnse(count)
            return {"data": data, "source": "dnse"}
        except Exception as dnse_err:
            logger.warning("DNSE top-stocks fallback also failed: %s", dnse_err)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/board")
async def get_price_board(
    symbols: str = Query(..., description="Comma-separated symbols"),
):
    symbol_list = [s.strip().upper() for s in symbols.split(",")]
    try:
        data = client.get_price_board(symbol_list)
        return {"data": data}
    except Exception as e:
        logger.warning("VCI price board failed: %s, using DNSE fallback", e)
        try:
            data = await _board_from_dnse(symbol_list)
            return {"data": data, "source": "dnse"}
        except Exception as dnse_err:
            logger.warning("DNSE board fallback also failed: %s", dnse_err)
        raise HTTPException(status_code=500, detail=str(e))


async def _board_from_dnse(symbols: list[str]) -> list[dict]:
    """Build price board data from DNSE OHLC as fallback when VCI is down."""
    import time

    now = int(time.time())
    results = []
    for sym in symbols:
        try:
            candles = await dnse.get_ohlc(sym, resolution="1D", from_ts=now - 7 * 86400, to_ts=now)
            if not candles:
                continue
            latest = candles[-1]
            prev = candles[-2] if len(candles) >= 2 else latest
            price = latest["close"]
            ref = prev["close"]
            change = round(price - ref, 2) if price and ref else 0
            pct = round(change / ref * 100, 2) if ref else 0
            results.append({
                "symbol": sym,
                "organ_name": sym,
                "match_price": price,
                "ref_price": ref,
                "open_price": latest.get("open"),
                "highest": latest.get("high"),
                "lowest": latest.get("low"),
                "accumulated_volume": latest.get("volume", 0),
                "change": change,
                "pct_change": pct,
            })
        except Exception as err:
            logger.debug("DNSE fallback failed for %s: %s", sym, err)
    return results


async def _top_stocks_from_dnse(count: int) -> list[dict]:
    """Get top stocks data from DNSE when VCI is down."""
    major = VnstockClient.MAJOR_STOCKS[:count + 10]
    board = await _board_from_dnse(major)
    board.sort(key=lambda r: r.get("accumulated_volume", 0), reverse=True)
    return board[:count]


class SignalRequest(BaseModel):
    symbols: list[str]


@router.post("/signals")
async def get_technical_signals(req: SignalRequest):
    """Compute MA50 and technical signals for a batch of symbols."""
    import time as _time

    to_ts = int(_time.time())
    from_ts = to_ts - 250 * 86400
    results: list[dict] = []

    for sym in req.symbols[:30]:
        try:
            price_data = await dnse.get_ohlc(
                sym.upper(), "1D", from_ts=from_ts, to_ts=to_ts,
            )
            if not price_data:
                continue
            signals = _compute_technical_signals(price_data)
            if signals.get("ma50"):
                results.append({"symbol": sym.upper(), **signals})
        except Exception as e:
            logger.warning("Signal compute failed for %s: %s", sym, e)

    return {"results": results}

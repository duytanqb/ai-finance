from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()


@router.get("/symbols")
async def get_all_symbols(
    exchange: str = Query(None, description="Filter by exchange: HOSE, HNX, UPCOM"),
):
    try:
        data = client.get_all_symbols(exchange)
        return {"count": len(data), "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_symbol(
    q: str = Query(..., description="Search query (symbol or company name)"),
):
    try:
        data = client.search_symbol(q)
        return {"query": q, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

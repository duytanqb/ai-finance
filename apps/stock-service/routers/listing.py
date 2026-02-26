from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()


@router.get("/symbols")
@router.get("/all-symbols")
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
    q: str = Query(None, description="Search query (symbol or company name)"),
    query: str = Query(None, description="Alias for q"),
):
    search_term = q or query
    if not search_term:
        raise HTTPException(status_code=400, detail="Provide 'q' or 'query' parameter")
    try:
        data = client.search_symbol(search_term)
        return {"query": search_term, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

router = APIRouter()
client = VnstockClient()


@router.get("/{symbol}/income-statement")
async def get_income_statement(
    symbol: str,
    period: str = Query("year", description="Period: year or quarter"),
):
    try:
        data = client.get_income_statement(symbol, period)
        return {"symbol": symbol, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/balance-sheet")
async def get_balance_sheet(
    symbol: str,
    period: str = Query("year", description="Period: year or quarter"),
):
    try:
        data = client.get_balance_sheet(symbol, period)
        return {"symbol": symbol, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/cash-flow")
async def get_cash_flow(
    symbol: str,
    period: str = Query("year", description="Period: year or quarter"),
):
    try:
        data = client.get_cash_flow(symbol, period)
        return {"symbol": symbol, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/ratios")
async def get_financial_ratios(symbol: str):
    try:
        data = client.get_financial_ratios(symbol)
        return {"symbol": symbol, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

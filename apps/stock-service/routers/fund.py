import logging
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_fund():
    from vnstock.explorer.fmarket.fund import Fund
    return Fund()


@router.get("/listing")
async def get_fund_listing(
    fund_type: str = Query(None, description="Filter: equity, balanced, bond"),
):
    """List all funds with NAV and performance metrics."""
    try:
        fund = _get_fund()
        df = fund.listing()
        if df.empty:
            return {"funds": []}

        type_map = {
            "equity": "Quỹ cổ phiếu",
            "balanced": "Quỹ cân bằng",
            "bond": "Quỹ trái phiếu",
        }
        if fund_type and fund_type in type_map:
            df = df[df["fund_type"] == type_map[fund_type]]

        records = df.to_dict(orient="records")
        for r in records:
            for k, v in r.items():
                if isinstance(v, float) and (v != v):
                    r[k] = None
        return {"funds": records, "total": len(records)}
    except Exception as e:
        logger.error("Fund listing failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/holdings")
async def get_fund_holdings(symbol: str):
    """Get top holdings and industry allocation for a fund."""
    try:
        fund = _get_fund()
        symbol = symbol.upper()

        holdings_df = fund.details.top_holding(symbol)
        holdings = holdings_df.to_dict(orient="records") if not holdings_df.empty else []

        industry_df = fund.details.industry_holding(symbol)
        industries = industry_df.to_dict(orient="records") if not industry_df.empty else []

        asset_df = fund.details.asset_holding(symbol)
        assets = asset_df.to_dict(orient="records") if not asset_df.empty else []

        return {
            "symbol": symbol,
            "holdings": holdings,
            "industry_allocation": industries,
            "asset_allocation": assets,
        }
    except Exception as e:
        logger.error("Fund holdings failed for %s: %s", symbol, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/nav")
async def get_fund_nav(
    symbol: str,
    limit: int = Query(90, ge=1, le=365, description="Number of recent NAV records"),
):
    """Get NAV history for a fund."""
    try:
        fund = _get_fund()
        symbol = symbol.upper()

        nav_df = fund.details.nav_report(symbol)
        if nav_df.empty:
            return {"symbol": symbol, "nav_history": []}

        records = nav_df.tail(limit).to_dict(orient="records")
        return {"symbol": symbol, "nav_history": records}
    except Exception as e:
        logger.error("Fund NAV failed for %s: %s", symbol, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overlap")
async def get_fund_overlap(
    symbols: str = Query(..., description="Comma-separated fund symbols, e.g. VESAF,SSISCA,DCDS"),
):
    """Find stocks held by multiple funds — the 'smart money consensus'."""
    try:
        fund = _get_fund()
        fund_symbols = [s.strip().upper() for s in symbols.split(",")]

        stock_funds: dict[str, list[dict]] = defaultdict(list)

        for fs in fund_symbols[:10]:
            try:
                df = fund.details.top_holding(fs)
                if df.empty:
                    continue
                for _, row in df.iterrows():
                    stock_code = row.get("stock_code", "")
                    if stock_code:
                        stock_funds[stock_code].append({
                            "fund": fs,
                            "weight": row.get("net_asset_percent", 0),
                            "industry": row.get("industry", ""),
                        })
            except Exception as e:
                logger.warning("Failed to get holdings for %s: %s", fs, e)

        overlap = []
        for stock, funds in stock_funds.items():
            if len(funds) >= 2:
                avg_weight = round(sum(f["weight"] for f in funds) / len(funds), 2)
                overlap.append({
                    "symbol": stock,
                    "fund_count": len(funds),
                    "avg_weight": avg_weight,
                    "total_weight": round(sum(f["weight"] for f in funds), 2),
                    "industry": funds[0]["industry"],
                    "funds": funds,
                })

        overlap.sort(key=lambda x: x["fund_count"], reverse=True)
        return {"overlap": overlap, "funds_analyzed": fund_symbols}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Fund overlap failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class SmartMoneyRequest(BaseModel):
    top_n: int = 10
    min_return_12m: float = 5.0


@router.post("/smart-money")
async def analyze_smart_money(req: SmartMoneyRequest):
    """Aggregate holdings from top-performing equity funds to find consensus picks."""
    try:
        fund = _get_fund()
        df = fund.listing()
        if df.empty:
            return {"consensus": [], "funds_analyzed": []}

        equity = df[df["fund_type"] == "Quỹ cổ phiếu"].copy()
        equity = equity.dropna(subset=["nav_change_12m"])
        equity = equity[equity["nav_change_12m"] >= req.min_return_12m]
        equity = equity.sort_values("nav_change_12m", ascending=False).head(req.top_n)

        top_fund_symbols = equity["short_name"].tolist()
        fund_performance = {
            row["short_name"]: {
                "name": row["name"],
                "nav": row["nav"],
                "return_1m": row.get("nav_change_1m"),
                "return_3m": row.get("nav_change_3m"),
                "return_12m": row.get("nav_change_12m"),
                "manager": row.get("fund_owner_name", ""),
            }
            for _, row in equity.iterrows()
        }
        for info in fund_performance.values():
            for k, v in info.items():
                if isinstance(v, float) and (v != v):
                    info[k] = None

        stock_funds: dict[str, list[dict]] = defaultdict(list)
        all_holdings: dict[str, list[dict]] = {}

        for fs in top_fund_symbols:
            try:
                hdf = fund.details.top_holding(fs)
                if hdf.empty:
                    continue
                holdings = hdf.to_dict(orient="records")
                all_holdings[fs] = holdings
                for row in holdings:
                    stock_code = row.get("stock_code", "")
                    if stock_code:
                        stock_funds[stock_code].append({
                            "fund": fs,
                            "weight": row.get("net_asset_percent", 0),
                            "industry": row.get("industry", ""),
                        })
            except Exception as e:
                logger.warning("Smart money: failed for %s: %s", fs, e)

        consensus = []
        for stock, funds in stock_funds.items():
            avg_weight = round(sum(f["weight"] for f in funds) / len(funds), 2)
            consensus.append({
                "symbol": stock,
                "fund_count": len(funds),
                "avg_weight": avg_weight,
                "total_weight": round(sum(f["weight"] for f in funds), 2),
                "industry": funds[0]["industry"],
                "funds": [f["fund"] for f in funds],
            })

        consensus.sort(key=lambda x: (-x["fund_count"], -x["avg_weight"]))

        return {
            "consensus": consensus,
            "funds_analyzed": top_fund_symbols,
            "fund_performance": fund_performance,
            "all_holdings": all_holdings,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Smart money analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

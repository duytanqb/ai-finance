"""Weekly fund snapshot job.

Fetches holdings for all equity + balanced funds and saves snapshots
to the database for tracking holding changes over time.
"""

import logging
import os
from datetime import date

import httpx

logger = logging.getLogger(__name__)

APP_URL = os.getenv("APP_URL", "http://localhost:3000")


async def run_fund_snapshot() -> dict:
    """Fetch all equity fund holdings and save snapshot to DB."""
    from vnstock.explorer.fmarket.fund import Fund

    fund = Fund()
    df = fund.listing()
    if df.empty:
        logger.warning("[FundSnapshot] No funds found")
        return {"saved": 0, "error": "No funds found"}

    equity_balanced = df[df["fund_type"].isin(["Quỹ cổ phiếu", "Quỹ cân bằng"])]
    today = date.today().isoformat()
    snapshots: list[dict] = []

    for _, row in equity_balanced.iterrows():
        symbol = row["short_name"]
        try:
            holdings_df = fund.details.top_holding(symbol)
            holdings = holdings_df.to_dict(orient="records") if not holdings_df.empty else []

            industry_df = fund.details.industry_holding(symbol)
            industries = industry_df.to_dict(orient="records") if not industry_df.empty else []

            nav = row.get("nav")
            if isinstance(nav, float) and (nav != nav):
                nav = None

            snapshots.append({
                "fund_symbol": symbol,
                "fund_name": row.get("name", symbol),
                "snapshot_date": today,
                "nav": nav,
                "holdings": holdings,
                "industry_allocation": industries,
            })
            logger.info("[FundSnapshot] Collected %s: %d holdings", symbol, len(holdings))
        except Exception as e:
            logger.warning("[FundSnapshot] Failed for %s: %s", symbol, e)

    if not snapshots:
        logger.warning("[FundSnapshot] No snapshots collected")
        return {"saved": 0}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                f"{APP_URL}/api/fund/snapshot",
                json={"snapshots": snapshots},
            )
            if res.status_code == 200:
                data = res.json()
                logger.info("[FundSnapshot] Saved %d/%d snapshots", data.get("saved", 0), len(snapshots))
                return data
            logger.error("[FundSnapshot] Save failed: %s", res.text)
            return {"saved": 0, "error": res.text}
    except Exception as e:
        logger.error("[FundSnapshot] HTTP save failed: %s", e)
        return {"saved": 0, "error": str(e)}

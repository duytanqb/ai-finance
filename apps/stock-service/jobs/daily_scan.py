"""Stage 2: Sector-driven stock discovery.

Given hot sectors from AI news analysis, find candidate stocks within
those sectors. No financial ratio calls — just collect symbols with basic info.
AI news selection (Stage 2.5) handles filtering before expensive finance checks.
"""

from collections.abc import Callable

from services.vnstock_client import VnstockClient

ALLOWED_EXCHANGES = {"HOSE", "HNX"}


async def run_sector_stock_discovery(
    hot_sectors: list[dict],
    max_per_sector: int = 25,
    on_progress: Callable[[str], None] | None = None,
) -> list[dict]:
    """Discover stocks from hot sectors identified by AI.

    For each sector:
      1. Get all stocks in that sector via vnstock industry data
      2. Filter to HOSE/HNX only (skip UPCOM)
      3. Attach sector metadata to each candidate

    No financial ratio fetching — that happens after AI news selection.
    """
    print(f"[SectorScan] Scanning {len(hot_sectors)} hot sectors (HOSE + HNX only)...")
    client = VnstockClient()

    seen: set[str] = set()
    candidates: list[dict] = []

    for si, sector in enumerate(hot_sectors):
        sector_name = sector.get("sector_name", "")
        confidence = sector.get("confidence", 0)
        thesis = sector.get("thesis", "")

        if on_progress:
            on_progress(f"Đang quét ngành {sector_name} ({si + 1}/{len(hot_sectors)})")
        print(f"\n  Sector: {sector_name} (confidence: {confidence})")

        try:
            stocks = client.get_stocks_by_industry(sector_name)
        except Exception as e:
            print(f"    Failed to get stocks: {e}")
            continue

        eligible = [
            s for s in stocks
            if s.get("type") == "stock"
            and s.get("exchange", "").upper() in ALLOWED_EXCHANGES
        ]
        skipped = len([s for s in stocks if s.get("type") == "stock"]) - len(eligible)
        print(f"    Found {len(eligible)} HOSE/HNX stocks (skipped {skipped} UPCOM)")

        added = 0
        for stock in eligible:
            if added >= max_per_sector:
                break

            symbol = stock.get("symbol", "")
            if not symbol or symbol in seen:
                continue

            seen.add(symbol)
            added += 1
            candidates.append({
                "symbol": symbol,
                "name": stock.get("organ_name", ""),
                "exchange": stock.get("exchange", ""),
                "sector_name": sector_name,
                "sector_confidence": confidence,
                "sector_thesis": thesis,
            })

        print(f"    {added} candidates added")

    print(f"\n[SectorScan] Total: {len(candidates)} unique candidates from {len(hot_sectors)} sectors")
    for c in candidates[:10]:
        print(f"  {c['symbol']}: Sector={c.get('sector_name')}")

    return candidates

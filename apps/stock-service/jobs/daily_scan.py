"""Stage 2: Sector-driven stock discovery.

Given hot sectors from AI news analysis, find candidate stocks within
those sectors and apply light pre-filters before the quality gate.
"""

import time

from services.cache import cache
from services.vnstock_client import VnstockClient

sf = VnstockClient._safe_float


async def run_sector_stock_discovery(
    hot_sectors: list[dict],
    max_per_sector: int = 20,
) -> list[dict]:
    """Discover stocks from hot sectors identified by AI.

    For each sector:
      1. Get all stocks in that sector via vnstock industry data
      2. Fetch financial ratios (with rate-limit throttle)
      3. Apply light pre-filters (PE > 0, PE < 30, market_cap > 300B)
      4. Attach sector metadata to each candidate

    Args:
        hot_sectors: List of dicts with sector_name, confidence, thesis, catalysts.
        max_per_sector: Max stocks to scan per sector (default 20).

    Returns:
        Deduplicated candidate list with sector metadata.
    """
    print(f"[SectorScan] Scanning {len(hot_sectors)} hot sectors...")
    client = VnstockClient()

    seen: set[str] = set()
    candidates: list[dict] = []

    for sector in hot_sectors:
        sector_name = sector.get("sector_name", "")
        confidence = sector.get("confidence", 0)
        thesis = sector.get("thesis", "")

        print(f"\n  Sector: {sector_name} (confidence: {confidence})")

        try:
            stocks = client.get_stocks_by_industry(sector_name)
        except Exception as e:
            print(f"    Failed to get stocks: {e}")
            continue

        stock_only = [s for s in stocks if s.get("type") == "stock"]
        print(f"    Found {len(stock_only)} stocks in sector")

        scanned = 0
        for stock in stock_only:
            if scanned >= max_per_sector:
                break

            symbol = stock.get("symbol", "")
            if not symbol or symbol in seen:
                continue

            try:
                cache_key = f"stock:ratios:{symbol.upper()}"
                is_cached = cache.get(cache_key) is not None
                ratios = client.get_financial_ratios(symbol)
                scanned += 1
                if not is_cached:
                    time.sleep(1.1)

                if not ratios:
                    continue

                latest = ratios[0]
                pe = sf(latest.get("priceToEarning"))
                market_cap = sf(latest.get("market_cap"))
                roe = sf(latest.get("roe"))

                # Light pre-filters
                if pe is None or pe <= 0 or pe > 30:
                    continue
                if market_cap is not None and market_cap < 0.3:
                    continue

                seen.add(symbol)
                candidates.append({
                    "symbol": symbol,
                    "name": stock.get("organ_name", ""),
                    "exchange": stock.get("exchange", ""),
                    "pe": pe,
                    "pb": sf(latest.get("priceToBook")),
                    "roe": roe,
                    "eps": sf(latest.get("earningPerShare")),
                    "net_profit_margin": sf(latest.get("netProfitMargin")),
                    "roa": sf(latest.get("roa")),
                    "financial_leverage": sf(latest.get("financialLeverage")),
                    "market_cap": market_cap,
                    "dividend_yield": sf(latest.get("dividend")),
                    "ratios": latest,
                    "sector_name": sector_name,
                    "sector_confidence": confidence,
                    "sector_thesis": thesis,
                })

            except Exception as e:
                exc_str = str(e).lower()
                if "rate limit" in exc_str or "429" in exc_str:
                    print(f"    Rate limit hit, waiting 60s...")
                    time.sleep(60)
                    scanned -= 1
                    continue
                continue

        sector_count = sum(1 for c in candidates if c.get("sector_name") == sector_name)
        print(f"    {sector_count} candidates passed pre-filter")

    print(f"\n[SectorScan] Total: {len(candidates)} unique candidates from {len(hot_sectors)} sectors")
    for c in candidates[:10]:
        print(f"  {c['symbol']}: PE={c.get('pe')}, ROE={c.get('roe')}, Sector={c.get('sector_name')}")

    return candidates

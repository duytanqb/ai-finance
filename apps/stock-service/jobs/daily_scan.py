"""Stage 2: Sector-driven stock discovery.

Given hot sectors from AI news analysis, find candidate stocks within
those sectors and apply pre-filters before the quality gate.

Only scans HOSE and HNX exchanges. Applies aggressive ratio-based
filtering to reduce the number of stocks that reach Stage 3.
"""

import time
from collections.abc import Callable

from services.cache import cache
from services.vnstock_client import VnstockClient

sf = VnstockClient._safe_float

ALLOWED_EXCHANGES = {"HOSE", "HNX"}


async def run_sector_stock_discovery(
    hot_sectors: list[dict],
    max_per_sector: int = 15,
    on_progress: Callable[[str], None] | None = None,
) -> list[dict]:
    """Discover stocks from hot sectors identified by AI.

    For each sector:
      1. Get all stocks in that sector via vnstock industry data
      2. Filter to HOSE/HNX only (skip UPCOM)
      3. Fetch financial ratios (with rate-limit throttle)
      4. Apply ratio-based pre-filters (PE, ROE, leverage, market cap)
      5. Attach sector metadata to each candidate

    Args:
        hot_sectors: List of dicts with sector_name, confidence, thesis, catalysts.
        max_per_sector: Max stocks to scan per sector (default 15).
        on_progress: Optional callback for progress reporting.

    Returns:
        Deduplicated candidate list with sector metadata.
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

        # Filter: only real stocks on HOSE/HNX
        eligible = [
            s for s in stocks
            if s.get("type") == "stock"
            and s.get("exchange", "").upper() in ALLOWED_EXCHANGES
        ]
        skipped = len([s for s in stocks if s.get("type") == "stock"]) - len(eligible)
        print(f"    Found {len(eligible)} HOSE/HNX stocks (skipped {skipped} UPCOM)")

        scanned = 0
        for stock in eligible:
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
                pb = sf(latest.get("priceToBook"))
                roe = sf(latest.get("roe"))
                market_cap = sf(latest.get("market_cap"))
                leverage = sf(latest.get("financialLeverage"))
                npm = sf(latest.get("netProfitMargin"))

                # Aggressive pre-filters (save Stage 3 API calls)
                if pe is None or pe <= 0 or pe > 25:
                    continue
                if market_cap is not None and market_cap < 0.5:
                    continue
                if roe is not None and roe < 0.05:
                    continue
                if leverage is not None and leverage > 4.0:
                    continue
                if npm is not None and npm < 0:
                    continue

                seen.add(symbol)
                candidates.append({
                    "symbol": symbol,
                    "name": stock.get("organ_name", ""),
                    "exchange": stock.get("exchange", ""),
                    "pe": pe,
                    "pb": pb,
                    "roe": roe,
                    "eps": sf(latest.get("earningPerShare")),
                    "net_profit_margin": npm,
                    "roa": sf(latest.get("roa")),
                    "financial_leverage": leverage,
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

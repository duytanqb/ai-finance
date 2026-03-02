"""News fetching: per-candidate enrichment + market-wide discovery."""

import asyncio
import os
from collections.abc import Callable

from services.news_crawler import NewsCrawler
from services.vnstock_client import VnstockClient

BATCH_SIZE = 5


async def run_news_fetch(
    candidates: list[dict],
    on_progress: Callable[[str], None] | None = None,
) -> list[dict]:
    """Fetch news for each candidate stock in parallel batches.

    Args:
        candidates: List with symbol, name, pe, roe, etc.
        on_progress: Optional callback for progress reporting.

    Returns:
        Enriched candidates with news list attached.
    """
    print(f"[NewsFetch] Fetching news for {len(candidates)} candidates (batch size={BATCH_SIZE})...")
    crawler = NewsCrawler()
    enriched = []
    total_batches = (len(candidates) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(candidates), BATCH_SIZE):
        batch = candidates[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        symbols = ", ".join(c["symbol"] for c in batch)

        if on_progress:
            on_progress(f"Đang tải tin cho {symbols} (batch {batch_num}/{total_batches})")

        tasks = [crawler.crawl_news(c["symbol"], limit=5) for c in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for candidate, result in zip(batch, results):
            if isinstance(result, list):
                print(f"  {candidate['symbol']}: {len(result)} articles found")
                enriched.append({**candidate, "news": result})
            else:
                print(f"  {candidate['symbol']}: news fetch failed - {result}")
                enriched.append({**candidate, "news": []})

    print(f"[NewsFetch] Done. {sum(len(c.get('news', [])) for c in enriched)} total articles")
    return enriched


async def run_news_discovery(existing_symbols: set[str]) -> list[dict]:
    """Stage 4: Discover stocks from market-wide news headlines.

    Crawls general market news, uses AI to extract tickers mentioned
    in positive investment contexts, fetches basic ratios for them.

    Args:
        existing_symbols: Symbols already in the pipeline (to avoid duplicates).

    Returns:
        List of news-discovered candidate dicts.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("[NewsDiscovery] No API key, skipping news discovery")
        return []

    crawler = NewsCrawler()

    print("[NewsDiscovery] Crawling market headlines...")
    headlines = await crawler.crawl_market_news(limit=30)
    if not headlines:
        print("[NewsDiscovery] No headlines found")
        return []

    print(f"[NewsDiscovery] Got {len(headlines)} headlines, extracting stock mentions...")
    from services.ai_workflows import AIWorkflowService

    ai = AIWorkflowService()
    news_data = [{"title": h["title"], "snippet": h.get("snippet", "")} for h in headlines]

    try:
        discovered = await ai.extract_stocks_from_news(news_data, exclude_symbols=existing_symbols)
    except Exception as e:
        print(f"[NewsDiscovery] AI extraction failed: {e}")
        return []

    if not discovered:
        print("[NewsDiscovery] No new stocks found in news")
        return []

    # Fetch basic ratios for discovered stocks
    client = VnstockClient()
    candidates = []
    for item in discovered[:5]:
        symbol = item.get("symbol", "").upper()
        if not symbol or symbol in existing_symbols:
            continue
        try:
            ratios = client.get_financial_ratios(symbol)
            if not ratios:
                continue
            latest = ratios[0]
            sf = VnstockClient._safe_float
            candidates.append({
                "symbol": symbol,
                "name": item.get("reason", ""),
                "exchange": "",
                "source": "news",
                "news_context": item.get("context", ""),
                "pe": sf(latest.get("priceToEarning")),
                "pb": sf(latest.get("priceToBook")),
                "roe": sf(latest.get("roe")),
                "eps": sf(latest.get("earningPerShare")),
                "market_cap": sf(latest.get("market_cap")),
                "net_profit_margin": sf(latest.get("netProfitMargin")),
                "financial_leverage": sf(latest.get("financialLeverage")),
                "dividend_yield": sf(latest.get("dividend")),
            })
            print(f"  [NewsDiscovery] Found {symbol}: {item.get('reason', '')}")
        except Exception:
            continue

    print(f"[NewsDiscovery] {len(candidates)} news-driven candidates")
    return candidates

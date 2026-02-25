"""Step 2: Crawl and summarize news for candidate stocks."""

from services.news_crawler import NewsCrawler


async def run_news_fetch(candidates: list[dict]) -> list[dict]:
    """Fetch news for each candidate stock.

    Args:
        candidates: List from daily_scan with symbol, name, pe, roe, score.

    Returns:
        Enriched candidates with news list attached.
    """
    print(f"[NewsFetch] Fetching news for {len(candidates)} candidates...")
    crawler = NewsCrawler()

    enriched = []
    for candidate in candidates:
        symbol = candidate["symbol"]
        try:
            news = await crawler.crawl_news(symbol, limit=5)
            print(f"  {symbol}: {len(news)} articles found")
            enriched.append({**candidate, "news": news})
        except Exception as e:
            print(f"  {symbol}: news fetch failed - {e}")
            enriched.append({**candidate, "news": []})

    print(f"[NewsFetch] Done. {sum(len(c.get('news', [])) for c in enriched)} total articles")
    return enriched

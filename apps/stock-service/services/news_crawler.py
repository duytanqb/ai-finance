"""News crawler for Vietnam financial news sources.

TODO: Implement crawlers for:
- CafeF (cafef.vn)
- VnExpress Finance (vnexpress.net/kinh-doanh)
- Vietstock (vietstock.vn)
"""


class NewsCrawler:
    """Crawl and parse financial news from Vietnamese sources."""

    async def crawl_news(self, symbol: str, limit: int = 10) -> list[dict]:
        """Fetch latest news for a stock symbol.

        Returns list of:
        {
            "title": str,
            "url": str,
            "source": str,
            "published_at": str,
            "snippet": str,
        }
        """
        # TODO: Implement actual news crawling
        return []

    async def crawl_market_news(self, limit: int = 20) -> list[dict]:
        """Fetch general market news."""
        # TODO: Implement market-wide news crawling
        return []

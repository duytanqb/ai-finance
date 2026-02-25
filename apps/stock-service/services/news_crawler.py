"""News crawler for Vietnam financial news sources."""

import httpx
from bs4 import BeautifulSoup


class NewsCrawler:
    """Crawl and parse financial news from Vietnamese sources."""

    def __init__(self):
        self.timeout = 10.0
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

    async def crawl_news(self, symbol: str, limit: int = 10) -> list[dict]:
        """Fetch latest news for a stock symbol from CafeF."""
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = f"https://cafef.vn/tim-kiem.htm?keywords={symbol}"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select(".tlitem, .list-news li, .knswli")[:limit]

                for article in articles:
                    title_el = article.select_one("a[title], h3 a, h2 a")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")
                    if href and not href.startswith("http"):
                        href = f"https://cafef.vn{href}"

                    snippet_el = article.select_one(".sapo, .knswli-sapo, p")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    date_el = article.select_one(".time, .knswli-time, .dateandcate")
                    published_at = date_el.get_text(strip=True) if date_el else ""

                    results.append(
                        {
                            "title": title,
                            "url": href,
                            "source": "CafeF",
                            "published_at": published_at,
                            "snippet": snippet[:300],
                        }
                    )
        except Exception as e:
            print(f"[NewsCrawler] Error crawling CafeF for {symbol}: {e}")

        # Also try VnExpress
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = f"https://timkiem.vnexpress.net/?q={symbol}&cate_code=kinhdoanh"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select("article.item-news, .search-item")[:limit]

                for article in articles:
                    title_el = article.select_one("h3 a, h2 a, .title-news a")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")

                    snippet_el = article.select_one("p.description, .description")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    date_el = article.select_one(".time-count, .date")
                    published_at = date_el.get_text(strip=True) if date_el else ""

                    results.append(
                        {
                            "title": title,
                            "url": href,
                            "source": "VnExpress",
                            "published_at": published_at,
                            "snippet": snippet[:300],
                        }
                    )
        except Exception as e:
            print(f"[NewsCrawler] Error crawling VnExpress for {symbol}: {e}")

        return results[:limit]

    async def crawl_market_news(self, limit: int = 20) -> list[dict]:
        """Fetch general market news from CafeF."""
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = "https://cafef.vn/thi-truong-chung-khoan.chn"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select(".tlitem, .list-news li, .knswli")[:limit]

                for article in articles:
                    title_el = article.select_one("a[title], h3 a, h2 a")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")
                    if href and not href.startswith("http"):
                        href = f"https://cafef.vn{href}"

                    snippet_el = article.select_one(".sapo, .knswli-sapo, p")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    date_el = article.select_one(".time, .knswli-time, .dateandcate")
                    published_at = date_el.get_text(strip=True) if date_el else ""

                    results.append(
                        {
                            "title": title,
                            "url": href,
                            "source": "CafeF",
                            "published_at": published_at,
                            "snippet": snippet[:300],
                        }
                    )
        except Exception as e:
            print(f"[NewsCrawler] Error crawling market news: {e}")

        return results[:limit]

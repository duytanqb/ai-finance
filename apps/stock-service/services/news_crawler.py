"""News crawler for Vietnam financial news sources."""

import re
from datetime import datetime, timedelta

import httpx
from bs4 import BeautifulSoup

MAX_AGE_DAYS = 30


def _parse_vn_date(text: str) -> datetime | None:
    """Parse Vietnamese date strings from CafeF/VnExpress.

    Common formats:
    - "27/02/2026 10:30"  (DD/MM/YYYY HH:MM)
    - "27-02-2026"        (DD-MM-YYYY)
    - "27/02/2026"        (DD/MM/YYYY)
    - "2 giờ trước"       (relative)
    - "3 ngày trước"      (relative)
    - "Thứ Hai, 27/02/2026 10:30 (GMT+7)"
    """
    if not text:
        return None

    text = text.strip()

    # Try relative time: "X giờ trước", "X phút trước", "X ngày trước"
    relative = re.search(r"(\d+)\s*(phút|giờ|ngày|tuần|tháng)\s*trước", text)
    if relative:
        amount = int(relative.group(1))
        unit = relative.group(2)
        now = datetime.now()
        if unit == "phút":
            return now - timedelta(minutes=amount)
        if unit == "giờ":
            return now - timedelta(hours=amount)
        if unit == "ngày":
            return now - timedelta(days=amount)
        if unit == "tuần":
            return now - timedelta(weeks=amount)
        if unit == "tháng":
            return now - timedelta(days=amount * 30)
        return None

    # Try DD/MM/YYYY HH:MM or DD/MM/YYYY
    date_match = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", text)
    if date_match:
        day, month, year = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
        try:
            return datetime(year, month, day)
        except ValueError:
            pass

    # Try YYYY-MM-DD (ISO format)
    iso_match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if iso_match:
        year, month, day = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        try:
            return datetime(year, month, day)
        except ValueError:
            pass

    return None


def _is_recent(published_at: str, max_days: int = MAX_AGE_DAYS) -> bool:
    """Check if article date is within max_days."""
    parsed = _parse_vn_date(published_at)
    if parsed is None:
        return False
    cutoff = datetime.now() - timedelta(days=max_days)
    return parsed >= cutoff


class NewsCrawler:
    """Crawl and parse financial news from Vietnamese sources."""

    def __init__(self):
        self.timeout = 10.0
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

    async def crawl_news(self, symbol: str, limit: int = 10) -> list[dict]:
        """Fetch latest news for a stock symbol from CafeF + VnExpress.

        Only returns articles published within the last 30 days.
        """
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = f"https://cafef.vn/tim-kiem.htm?keywords={symbol}"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select(".tlitem, .list-news li, .knswli")[:limit * 2]

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

                    if not _is_recent(published_at):
                        continue

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

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = f"https://timkiem.vnexpress.net/?q={symbol}&cate_code=kinhdoanh"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select("article.item-news, .search-item")[:limit * 2]

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

                    if not _is_recent(published_at):
                        continue

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
        """Fetch general market news from CafeF. Only recent articles."""
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = "https://cafef.vn/thi-truong-chung-khoan.chn"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select(".tlitem, .list-news li, .knswli")[:limit * 2]

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

                    if not _is_recent(published_at):
                        continue

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

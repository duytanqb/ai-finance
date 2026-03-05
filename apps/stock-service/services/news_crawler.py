"""News crawler for Vietnam financial news sources."""

import asyncio
import re
from datetime import datetime, timedelta

import httpx
from bs4 import BeautifulSoup

MAX_AGE_DAYS = 30


def _parse_vn_date(text: str) -> datetime | None:
    """Parse Vietnamese date strings from CafeF/VnExpress/Vietstock.

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


def _deduplicate(articles: list[dict]) -> list[dict]:
    """Remove duplicate articles by title similarity."""
    seen_titles: set[str] = set()
    unique = []
    for article in articles:
        title_key = article["title"].strip().lower()[:60]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique.append(article)
    return unique


class NewsCrawler:
    """Crawl and parse financial news from Vietnamese sources."""

    def __init__(self):
        self.timeout = 10.0
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

    async def crawl_news(self, symbol: str, limit: int = 10) -> list[dict]:
        """Fetch latest news for a stock symbol from CafeF + VnExpress + Vietstock.

        All 3 sources are fetched in parallel. Only returns articles
        published within the last 30 days.
        """
        results = await asyncio.gather(
            self._crawl_cafef_symbol(symbol, limit),
            self._crawl_vnexpress_symbol(symbol, limit),
            self._crawl_vietstock_symbol(symbol, limit),
            return_exceptions=True,
        )

        all_articles: list[dict] = []
        for r in results:
            if isinstance(r, list):
                all_articles.extend(r)

        return _deduplicate(all_articles)[:limit]

    async def crawl_market_news(self, limit: int = 20) -> list[dict]:
        """Fetch general market news from CafeF + VnExpress + Vietstock + VnEconomy + SSI in parallel."""
        results = await asyncio.gather(
            self._crawl_cafef_market(limit),
            self._crawl_vnexpress_market(limit),
            self._crawl_vietstock_market(limit),
            self._crawl_vneconomy_market(limit),
            self._crawl_ssi_market(limit),
            return_exceptions=True,
        )

        all_articles: list[dict] = []
        for r in results:
            if isinstance(r, list):
                all_articles.extend(r)

        return _deduplicate(all_articles)[:limit]

    # ── CafeF ──────────────────────────────────────────────────

    async def _crawl_cafef_symbol(self, symbol: str, limit: int) -> list[dict]:
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = f"https://cafef.vn/co-phieu-{symbol.lower()}.html"
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

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "CafeF",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling CafeF for {symbol}: {e}")
        return results

    async def _crawl_cafef_market(self, limit: int) -> list[dict]:
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

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "CafeF",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling CafeF market news: {e}")
        return results

    # ── VnExpress ──────────────────────────────────────────────

    async def _crawl_vnexpress_symbol(self, symbol: str, limit: int) -> list[dict]:
        results = []
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

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "VnExpress",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling VnExpress for {symbol}: {e}")
        return results

    async def _crawl_vnexpress_market(self, limit: int) -> list[dict]:
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = "https://vnexpress.net/kinh-doanh/chung-khoan"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select("article.item-news, .item-news-common")[:limit * 2]

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

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "VnExpress",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling VnExpress market news: {e}")
        return results

    # ── Vietstock ──────────────────────────────────────────────

    async def _crawl_vietstock_symbol(self, symbol: str, limit: int) -> list[dict]:
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = f"https://vietstock.vn/tim-kiem.htm?q={symbol}"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select(".search-item, .news-item, article")[:limit * 2]

                for article in articles:
                    title_el = article.select_one("a[title], h3 a, h2 a, .title a")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    if not title:
                        continue
                    href = title_el.get("href", "")
                    if href and not href.startswith("http"):
                        href = f"https://vietstock.vn{href}"

                    snippet_el = article.select_one(".sapo, .description, p")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    date_el = article.select_one(".date, .time, time")
                    published_at = ""
                    if date_el:
                        published_at = date_el.get("datetime", "") or date_el.get_text(strip=True)

                    if published_at and not _is_recent(published_at):
                        continue

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "Vietstock",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling Vietstock for {symbol}: {e}")
        return results

    async def _crawl_vietstock_market(self, limit: int) -> list[dict]:
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = "https://vietstock.vn/chung-khoan.htm"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.select(".news-item, article, .item-news")[:limit * 2]

                for article in articles:
                    title_el = article.select_one("a[title], h3 a, h2 a, .title a")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    if not title:
                        continue
                    href = title_el.get("href", "")
                    if href and not href.startswith("http"):
                        href = f"https://vietstock.vn{href}"

                    snippet_el = article.select_one(".sapo, .description, p")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    date_el = article.select_one(".date, .time, time")
                    published_at = ""
                    if date_el:
                        published_at = date_el.get("datetime", "") or date_el.get_text(strip=True)

                    if published_at and not _is_recent(published_at):
                        continue

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "Vietstock",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling Vietstock market news: {e}")
        return results

    # ── VnEconomy ─────────────────────────────────────────────

    async def _crawl_vneconomy_market(self, limit: int) -> list[dict]:
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = "https://vneconomy.vn/chung-khoan.htm"
                resp = await client.get(url)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.select(".featured-row_item")[:limit * 2]

                for item in items:
                    title_container = item.select_one(".featured-row_item__title")
                    if not title_container:
                        continue

                    h3 = title_container.select_one("h3")
                    if not h3:
                        continue

                    title = h3.get("title", "") or h3.get_text(strip=True)
                    if not title:
                        continue

                    a = title_container.select_one("a") or item.select_one("a[href$='.htm']")
                    href = a.get("href", "") if a else ""
                    if not href:
                        link_layer = item.select_one("a.link-layer-imt")
                        href = link_layer.get("href", "") if link_layer else ""
                    if href and not href.startswith("http"):
                        href = f"https://vneconomy.vn{href}"

                    snippet_el = title_container.select_one("p")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    results.append({
                        "title": title,
                        "url": href,
                        "source": "VnEconomy",
                        "published_at": "",
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling VnEconomy market news: {e}")
        return results

    # ── SSI Research ──────────────────────────────────────────

    async def _crawl_ssi_market(self, limit: int) -> list[dict]:
        results = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, headers=self.headers
            ) as client:
                url = "https://www.ssi.com.vn/khach-hang-ca-nhan/ban-tin-thi-truong"
                resp = await client.get(url, follow_redirects=True)
                resp.raise_for_status()

                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.select(".chart__content__item")[:limit * 2]

                for item in items:
                    title_el = item.select_one("a.titlePost")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    if not title:
                        continue

                    desc_el = item.select_one(".chart__content__item__desc__info")
                    snippet = desc_el.get_text(strip=True) if desc_el else ""

                    time_el = item.select_one(".chart__content__item__time")
                    published_at = ""
                    if time_el:
                        raw = time_el.get_text(strip=True)
                        date_match = re.search(r"\d{2}/\d{2}/\d{4}", raw)
                        published_at = date_match.group(0) if date_match else raw

                    if published_at and not _is_recent(published_at):
                        continue

                    results.append({
                        "title": title,
                        "url": "https://www.ssi.com.vn/khach-hang-ca-nhan/ban-tin-thi-truong",
                        "source": "SSI Research",
                        "published_at": published_at,
                        "snippet": snippet[:300],
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error crawling SSI market news: {e}")
        return results

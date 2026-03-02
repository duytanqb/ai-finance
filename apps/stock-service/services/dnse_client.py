"""DNSE Lightspeed API client for chart data and trading."""

import base64
import hashlib
import hmac
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import httpx

from services.cache import TTL_FINANCIAL, TTL_PRICE, cache

BASE_URL = "https://services.entrade.com.vn"
OPENAPI_URL = "https://openapi.dnse.com.vn"


class DnseClient:
    """Client for DNSE Entrade API (chart data + auth)."""

    def __init__(self):
        self.timeout = 10.0

    async def get_ohlc(
        self,
        symbol: str,
        resolution: str = "1D",
        from_ts: int | None = None,
        to_ts: int | None = None,
    ) -> list[dict]:
        """Fetch OHLC candle data (free, no auth required).

        Args:
            symbol: Stock symbol (e.g. VCB, FPT).
            resolution: 1, 5, 15, 30, 1H, 1D, 1W.
            from_ts: Start unix timestamp.
            to_ts: End unix timestamp.

        Returns:
            List of {time, open, high, low, close, volume} dicts.
        """
        symbol = symbol.upper()
        now = int(time.time())
        if to_ts is None:
            to_ts = now
        if from_ts is None:
            from_ts = to_ts - 365 * 86400

        cache_key = f"dnse:ohlc:{symbol}:{resolution}:{from_ts}:{to_ts}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{BASE_URL}/chart-api/v2/ohlcs/stock"
        params = {
            "resolution": resolution,
            "symbol": symbol,
            "from": str(from_ts),
            "to": str(to_ts),
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        candles = self._parse_ohlc(data)
        ttl = TTL_PRICE if resolution in ("1", "5", "15", "30", "1H") else TTL_FINANCIAL
        cache.set(cache_key, candles, ttl)
        return candles

    async def get_index_ohlc(
        self,
        symbol: str = "VNINDEX",
        resolution: str = "1D",
        from_ts: int | None = None,
        to_ts: int | None = None,
    ) -> list[dict]:
        """Fetch index OHLC data (free, no auth required).

        Args:
            symbol: Index name (VNINDEX, HNXINDEX, UPCOMINDEX).
            resolution: 1, 5, 15, 30, 1H, 1D, 1W.
            from_ts: Start unix timestamp.
            to_ts: End unix timestamp.

        Returns:
            List of {time, open, high, low, close, volume} dicts.
        """
        symbol = symbol.upper()
        now = int(time.time())
        if to_ts is None:
            to_ts = now
        if from_ts is None:
            from_ts = to_ts - 365 * 86400

        cache_key = f"dnse:index:{symbol}:{resolution}:{from_ts}:{to_ts}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{BASE_URL}/chart-api/v2/ohlcs/index"
        params = {
            "resolution": resolution,
            "symbol": symbol,
            "from": str(from_ts),
            "to": str(to_ts),
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        candles = self._parse_ohlc(data)
        ttl = TTL_PRICE if resolution in ("1", "5", "15", "30", "1H") else TTL_FINANCIAL
        cache.set(cache_key, candles, ttl)
        return candles

    @staticmethod
    def _build_signature(api_secret: str, method: str, path: str, date_value: str, nonce: str | None = None) -> str:
        """Build HMAC-SHA256 signature following DNSE HTTP Signature spec."""
        sig_string = f"(request-target): {method.lower()} {path}\ndate: {date_value}"
        if nonce:
            sig_string += f"\nnonce: {nonce}"
        mac = hmac.new(api_secret.encode("utf-8"), sig_string.encode("utf-8"), hashlib.sha256)
        return quote(base64.b64encode(mac.digest()).decode("utf-8"), safe="")

    @staticmethod
    def _make_openapi_headers(api_key: str, api_secret: str, method: str, path: str) -> dict:
        """Create signed headers for DNSE OpenAPI requests."""
        date_value = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S %z")
        nonce = uuid.uuid4().hex
        headers_list = "(request-target) date"
        signature = DnseClient._build_signature(api_secret, method, path, date_value, nonce)
        sig_header = (
            f'Signature keyId="{api_key}",algorithm="hmac-sha256",'
            f'headers="{headers_list}",signature="{signature}",nonce="{nonce}"'
        )
        return {
            "Date": date_value,
            "X-Signature": sig_header,
            "x-api-key": api_key,
        }

    async def verify_api_key(self, api_key: str, api_secret: str) -> bool:
        """Test if DNSE API Key and Secret are valid.

        Calls GET /accounts on DNSE OpenAPI to verify credentials.

        Returns:
            True if the API key is accepted.
        """
        try:
            path = "/accounts"
            headers = self._make_openapi_headers(api_key, api_secret, "GET", path)
            url = f"{OPENAPI_URL}{path}"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, headers=headers)
                return resp.status_code == 200
        except Exception:
            return False

    @staticmethod
    def _parse_ohlc(data: dict) -> list[dict]:
        """Parse DNSE OHLC response into list of candle dicts.

        DNSE returns: {t: [timestamps], o: [], h: [], l: [], c: [], v: []}
        We convert to: [{time, open, high, low, close, volume}, ...]

        Prices are in 1000 VND units (65.0 = 65,000 VND).
        """
        timestamps = data.get("t", [])
        opens = data.get("o", [])
        highs = data.get("h", [])
        lows = data.get("l", [])
        closes = data.get("c", [])
        volumes = data.get("v", [])

        if not timestamps:
            return []

        candles = []
        for i in range(len(timestamps)):
            candles.append({
                "time": timestamps[i],
                "open": opens[i] if i < len(opens) else None,
                "high": highs[i] if i < len(highs) else None,
                "low": lows[i] if i < len(lows) else None,
                "close": closes[i] if i < len(closes) else None,
                "volume": volumes[i] if i < len(volumes) else None,
            })
        return candles

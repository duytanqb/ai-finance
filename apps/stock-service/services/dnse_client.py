"""DNSE Lightspeed API client for chart data and trading."""

import hashlib
import hmac
import time

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
    def _sign(api_secret: str, message: str) -> str:
        """Create HMAC-SHA256 signature for DNSE OpenAPI."""
        return hmac.new(
            api_secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    async def verify_api_key(self, api_key: str, api_secret: str) -> bool:
        """Test if DNSE API Key and Secret are valid.

        Calls a lightweight OpenAPI endpoint to verify credentials.

        Returns:
            True if the API key is accepted.
        """
        try:
            ts = str(int(time.time() * 1000))
            signature = self._sign(api_secret, ts)
            headers = {
                "X-API-Key": api_key,
                "X-Signature": signature,
                "X-Timestamp": ts,
            }
            url = f"{OPENAPI_URL}/api/account"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, headers=headers)
                return resp.status_code == 200
        except httpx.HTTPStatusError:
            return False
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

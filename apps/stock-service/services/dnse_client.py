"""DNSE Lightspeed API client for chart data and trading."""

import time

import httpx

from services.cache import TTL_FINANCIAL, TTL_PRICE, cache

BASE_URL = "https://services.entrade.com.vn"


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

    async def authenticate(self, username: str, password: str) -> dict:
        """Authenticate with DNSE and get JWT token.

        Args:
            username: DNSE username.
            password: DNSE password.

        Returns:
            Auth response with token.
        """
        url = f"{BASE_URL}/dnse-user-service/api/auth"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                url,
                json={"username": username, "password": password},
            )
            resp.raise_for_status()
            return resp.json()

    async def verify_credentials(self, username: str, password: str) -> bool:
        """Test if DNSE credentials are valid.

        Returns:
            True if authentication succeeds.
        """
        try:
            result = await self.authenticate(username, password)
            return bool(result.get("token"))
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

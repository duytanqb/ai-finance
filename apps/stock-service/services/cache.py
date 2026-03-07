import json
import logging
import os
from datetime import date, datetime
from typing import Any

import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

TTL_PRICE = 300
TTL_FINANCIAL = 3600
TTL_COMPANY = 86400
TTL_LISTING = 86400


def _json_serializer(obj: Any) -> str:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            import math
            f = float(obj)
            return None if math.isnan(f) or math.isinf(f) else f
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
    except ImportError:
        pass
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _sanitize_for_json(obj: Any) -> Any:
    """Recursively convert non-JSON-safe keys (tuples) and values before serialization."""
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(item) for item in obj]
    return obj


class CacheService:
    def __init__(self, url: str | None = None):
        self._client: redis.Redis | None = None
        self._url = url or REDIS_URL
        self._connect()

    def _connect(self) -> None:
        try:
            self._client = redis.from_url(
                self._url, decode_responses=True, socket_connect_timeout=2
            )
            self._client.ping()
            logger.info("Redis connected at %s", self._url)
        except (redis.ConnectionError, redis.TimeoutError, OSError) as exc:
            logger.warning("Redis unavailable (%s), caching disabled", exc)
            self._client = None

    @property
    def available(self) -> bool:
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except (redis.ConnectionError, redis.TimeoutError, OSError):
            self._client = None
            return False

    def get(self, key: str) -> Any | None:
        if not self.available:
            return None
        try:
            raw = self._client.get(key)  # type: ignore[union-attr]
            if raw is None:
                return None
            return json.loads(raw)
        except (redis.RedisError, json.JSONDecodeError) as exc:
            logger.warning("Cache get error for %s: %s", key, exc)
            return None

    def set(self, key: str, value: Any, ttl: int = TTL_PRICE) -> bool:
        if not self.available:
            return False
        try:
            safe_value = _sanitize_for_json(value)
            raw = json.dumps(safe_value, default=_json_serializer)
            self._client.setex(key, ttl, raw)  # type: ignore[union-attr]
            return True
        except (redis.RedisError, TypeError) as exc:
            logger.warning("Cache set error for %s: %s", key, exc)
            return False

    def delete(self, key: str) -> bool:
        if not self.available:
            return False
        try:
            self._client.delete(key)  # type: ignore[union-attr]
            return True
        except redis.RedisError as exc:
            logger.warning("Cache delete error for %s: %s", key, exc)
            return False

    def keys(self, pattern: str) -> list[str]:
        if not self.available:
            return []
        try:
            return [k.decode() if isinstance(k, bytes) else k for k in self._client.scan_iter(match=pattern, count=100)]  # type: ignore[union-attr]
        except redis.RedisError as exc:
            logger.warning("Cache keys error for %s: %s", pattern, exc)
            return []

    def clear(self, pattern: str = "stock:*") -> int:
        if not self.available:
            return 0
        try:
            keys = list(self._client.scan_iter(match=pattern, count=100))  # type: ignore[union-attr]
            if keys:
                return self._client.delete(*keys)  # type: ignore[union-attr]
            return 0
        except redis.RedisError as exc:
            logger.warning("Cache clear error: %s", exc)
            return 0


cache = CacheService()

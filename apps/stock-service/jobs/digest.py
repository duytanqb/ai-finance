"""Market Watch digest pipeline: scan → news → research → digest → persist."""

import json
import os
from datetime import datetime

import httpx

from jobs.daily_scan import run_daily_scan
from jobs.deep_research import run_deep_research
from jobs.news_fetch import run_news_fetch

_latest_digest: dict | None = None


def get_latest_digest() -> dict | None:
    return _latest_digest


async def run_and_persist() -> dict:
    """Run the full pipeline and save result to DB via Next.js API."""
    digest = await run_daily_digest()
    await _save_to_db(digest)
    return digest


async def run_daily_digest() -> dict:
    """Run full pipeline: scan → news → research → digest.

    Returns structured digest dict.
    """
    global _latest_digest

    print("=" * 60)
    print(f"[Digest] Starting pipeline at {datetime.now()}")
    print("=" * 60)

    # Step 1: Scan for candidates
    print("\n[Digest] Step 1/3: Daily scan...")
    try:
        candidates = await run_daily_scan()
    except Exception as e:
        print(f"[Digest] Daily scan failed: {e}")
        candidates = []

    if not candidates:
        print("[Digest] No candidates found, generating empty digest")
        digest = _build_digest([], datetime.now())
        _latest_digest = digest
        return digest

    # Step 2: Fetch news
    print("\n[Digest] Step 2/3: News fetch...")
    try:
        enriched = await run_news_fetch(candidates)
    except Exception as e:
        print(f"[Digest] News fetch failed: {e}")
        enriched = [{**c, "news": []} for c in candidates]

    # Step 3: AI analysis on top picks
    print("\n[Digest] Step 3/3: AI deep research...")
    try:
        final = await run_deep_research(enriched)
    except Exception as e:
        print(f"[Digest] Deep research failed: {e}")
        final = [{**c, "ai_analysis": None} for c in enriched]

    digest = _build_digest(final, datetime.now())
    _latest_digest = digest

    print(f"\n[Digest] Pipeline complete. {len(digest['top_picks'])} stocks in digest")
    print("=" * 60)

    return digest


async def _save_to_db(digest: dict) -> None:
    """POST digest to Next.js API for DB persistence."""
    app_url = os.environ.get("APP_URL", "http://localhost:3000")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{app_url}/api/stocks/market-watch",
                json=digest,
                timeout=10,
            )
            if resp.status_code < 300:
                print(f"[Digest] Saved to DB via {app_url}")
            else:
                print(f"[Digest] DB save failed: HTTP {resp.status_code}")
    except Exception as e:
        print(f"[Digest] DB save failed: {e}")


def _build_digest(candidates: list[dict], now: datetime) -> dict:
    """Build structured digest from enriched candidates."""
    top_picks = []
    for c in candidates:
        ai = c.get("ai_analysis") or {}
        pick = {
            "symbol": c["symbol"],
            "name": c.get("name", ""),
            "exchange": c.get("exchange", ""),
            "price": c.get("price"),
            "pe": c.get("pe"),
            "roe": c.get("roe"),
            "score": c.get("score"),
            "action": ai.get("action", "WATCH"),
            "confidence": ai.get("confidence", 0),
            "summary": ai.get("summary", f"PE={c.get('pe')}, ROE={c.get('roe')}%"),
            "entry_price": ai.get("entry_price"),
            "target_price": ai.get("target_price"),
            "news_count": len(c.get("news", [])),
            "top_news": c.get("news", [])[:3],
        }
        top_picks.append(pick)

    return {
        "date": now.strftime("%Y-%m-%d"),
        "generated_at": now.isoformat(),
        "market_summary": f"Quét {len(candidates)} cổ phiếu giá trị trên HOSE/HNX. Lọc theo P/E ≤ 20 và ROE ≥ 10%.",
        "top_picks": top_picks,
        "total_scanned": len(candidates),
    }

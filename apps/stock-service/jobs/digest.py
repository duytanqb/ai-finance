"""Market Watch digest pipeline: sector-first funnel.

Stage 1: News → Sector Discovery (crawl headlines → AI identifies 3-5 hot sectors)
Stage 2: Sector → Stock Discovery (get stocks in hot sectors → light pre-filter)
Stage 3: Quality Gate (financial disqualifiers + composite score)
Stage 4: AI Analysis + Sector Context (batch assess + full analysis with sector thesis)
Stage 5: News Enrichment (per-candidate articles)
"""

import os
from datetime import datetime

import httpx

from jobs.daily_scan import run_sector_stock_discovery
from jobs.deep_research import run_deep_research
from jobs.news_fetch import run_news_fetch
from jobs.quality_gate import run_quality_gate

_latest_digest: dict | None = None


def get_latest_digest() -> dict | None:
    return _latest_digest


async def run_and_persist() -> dict:
    """Run the full pipeline and save result to DB via Next.js API."""
    digest = await run_daily_digest()
    await _save_to_db(digest)
    return digest


async def run_daily_digest() -> dict:
    """Run full 5-stage sector-first pipeline."""
    global _latest_digest

    print("=" * 60)
    print(f"[Digest] Starting sector-first pipeline at {datetime.now()}")
    print("=" * 60)

    stage_counts = {}
    sector_analysis = None

    # Stage 1: News → Sector Discovery
    print("\n[Digest] Stage 1/5: News → Sector Discovery...")
    hot_sectors = []
    try:
        sector_analysis = await _discover_sectors()
        hot_sectors = sector_analysis.get("sectors", [])
        stage_counts["stage1_sectors"] = len(hot_sectors)
        stage_counts["market_mood"] = sector_analysis.get("market_mood", "neutral")
        print(f"[Digest] Stage 1 result: {len(hot_sectors)} hot sectors identified")
        for s in hot_sectors:
            print(f"  - {s.get('sector_name')} (confidence: {s.get('confidence')})")
    except Exception as e:
        print(f"[Digest] Stage 1 failed: {e}")
        stage_counts["stage1_sectors"] = 0

    if not hot_sectors:
        print("[Digest] No hot sectors found, generating empty digest")
        digest = _build_digest([], sector_analysis, datetime.now(), {})
        _latest_digest = digest
        return digest

    # Stage 2: Sector → Stock Discovery
    print("\n[Digest] Stage 2/5: Sector → Stock Discovery...")
    try:
        candidates = await run_sector_stock_discovery(hot_sectors)
        stage_counts["stage2"] = len(candidates)
        print(f"[Digest] Stage 2 result: {len(candidates)} candidates from sectors")
    except Exception as e:
        print(f"[Digest] Stage 2 failed: {e}")
        candidates = []
        stage_counts["stage2"] = 0

    if not candidates:
        print("[Digest] No candidates found in sectors")
        digest = _build_digest([], sector_analysis, datetime.now(), stage_counts)
        _latest_digest = digest
        return digest

    # Stage 3: Quality Gate
    print("\n[Digest] Stage 3/5: Financial quality gate...")
    try:
        qualified = await run_quality_gate(candidates)
        stage_counts["stage3"] = len(qualified)
        print(f"[Digest] Stage 3 result: {len(qualified)} qualified")
    except Exception as e:
        print(f"[Digest] Stage 3 failed: {e}")
        qualified = candidates[:20]
        stage_counts["stage3"] = len(qualified)

    # Stage 4: AI Analysis with sector context
    print("\n[Digest] Stage 4/5: AI analysis with sector context...")
    try:
        analyzed = await run_deep_research(qualified, sector_analysis)
        ai_count = sum(
            1 for a in analyzed
            if a.get("ai_analysis") and a["ai_analysis"].get("confidence", 0) > 0
        )
        stage_counts["stage4_analyzed"] = ai_count
        stage_counts["stage4_total"] = len(analyzed)
        print(f"[Digest] Stage 4 result: {len(analyzed)} stocks ({ai_count} fully analyzed)")
    except Exception as e:
        print(f"[Digest] Stage 4 failed: {e}")
        analyzed = [{**c, "ai_analysis": None} for c in qualified]
        stage_counts["stage4_analyzed"] = 0
        stage_counts["stage4_total"] = len(analyzed)

    # Stage 5: News enrichment
    print("\n[Digest] Stage 5/5: News enrichment...")
    try:
        enriched = await run_news_fetch(analyzed)
    except Exception as e:
        print(f"[Digest] Stage 5 failed: {e}")
        enriched = [{**c, "news": []} for c in analyzed]

    digest = _build_digest(enriched, sector_analysis, datetime.now(), stage_counts)
    _latest_digest = digest

    print(f"\n[Digest] Pipeline complete. {len(digest['top_picks'])} picks across {len(digest.get('sector_groups', {}))} sectors")
    print("=" * 60)

    return digest


async def _discover_sectors() -> dict:
    """Crawl market news and use AI to identify hot sectors."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    from services.ai_workflows import AIWorkflowService
    from services.news_crawler import NewsCrawler

    crawler = NewsCrawler()
    print("  Crawling market headlines...")
    headlines = await crawler.crawl_market_news(limit=40)
    if not headlines:
        raise ValueError("No headlines found")

    print(f"  Got {len(headlines)} headlines, analyzing sectors...")
    ai = AIWorkflowService()
    news_data = [{"title": h["title"], "snippet": h.get("snippet", "")} for h in headlines]
    result = await ai.analyze_sectors_from_news(news_data)
    return result


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


def _auto_summary(c: dict) -> str:
    """Generate summary from metrics when AI is unavailable."""
    parts = []
    if c.get("pe"):
        parts.append(f"P/E={c['pe']:.1f}")
    if c.get("roe"):
        parts.append(f"ROE={c['roe']:.1%}")
    if c.get("pb"):
        parts.append(f"P/B={c['pb']:.1f}")
    if c.get("quality_score"):
        parts.append(f"Score={c['quality_score']:.0f}/100")
    income = c.get("income_summary", {})
    if income.get("revenue_growth_pct") is not None:
        parts.append(f"Doanh thu YoY={income['revenue_growth_pct']:+.0%}")
    return ", ".join(parts) if parts else "Đang chờ phân tích"


def _build_digest(
    candidates: list[dict],
    sector_analysis: dict | None,
    now: datetime,
    stage_counts: dict,
) -> dict:
    """Build structured digest with sector grouping."""
    top_picks = []
    sector_groups: dict[str, list[dict]] = {}

    for c in candidates:
        ai = c.get("ai_analysis") or {}
        sector_name = c.get("sector_name", "Khác")

        pick = {
            "symbol": c["symbol"],
            "name": c.get("name", ""),
            "exchange": c.get("exchange", ""),
            "price": c.get("price"),
            "pe": c.get("pe"),
            "pb": c.get("pb"),
            "roe": c.get("roe"),
            "eps": c.get("eps"),
            "quality_score": c.get("quality_score"),
            "score": c.get("score"),
            "action": ai.get("action", c.get("ai_verdict", "WATCH")),
            "confidence": ai.get("confidence", 0),
            "summary": ai.get("summary") or c.get("ai_reason") or _auto_summary(c),
            "entry_price": ai.get("entry_price"),
            "target_price": ai.get("target_price"),
            "stop_loss": ai.get("stop_loss"),
            "risk_level": ai.get("risk_level"),
            "sector_name": sector_name,
            "sector_thesis": c.get("sector_thesis", ""),
            "sector_alignment": ai.get("sector_alignment", c.get("sector_alignment", "")),
            "source": "sector",
            "news_count": len(c.get("news", [])),
            "top_news": c.get("news", [])[:3],
            "income_summary": c.get("income_summary"),
            "balance_summary": c.get("balance_summary"),
        }
        top_picks.append(pick)

        if sector_name not in sector_groups:
            sector_groups[sector_name] = []
        sector_groups[sector_name].append(pick)

    top_picks.sort(
        key=lambda x: (
            x.get("confidence", 0) > 0,
            x.get("confidence", 0),
            x.get("quality_score", 0),
        ),
        reverse=True,
    )

    # Build sector summaries
    sectors_info = []
    if sector_analysis:
        for s in sector_analysis.get("sectors", []):
            name = s.get("sector_name", "")
            group = sector_groups.get(name, [])
            sectors_info.append({
                "sector_name": name,
                "confidence": s.get("confidence", 0),
                "thesis": s.get("thesis", ""),
                "catalysts": s.get("catalysts", []),
                "stock_count": len(group),
            })

    market_mood = "neutral"
    if sector_analysis:
        market_mood = sector_analysis.get("market_mood", "neutral")

    sector_count = len(sector_groups)
    summary_parts = [
        f"Phân tích tin tức thị trường → phát hiện {sector_count} ngành nóng.",
        f"Lọc {len(top_picks)} cổ phiếu tiềm năng qua 5 giai đoạn.",
    ]
    if top_picks:
        summary_parts.append("Top picks được AI phân tích chuyên sâu với bối cảnh ngành.")

    return {
        "date": now.strftime("%Y-%m-%d"),
        "generated_at": now.isoformat(),
        "market_summary": " ".join(summary_parts),
        "market_mood": market_mood,
        "pipeline_type": "sector-first",
        "sector_analysis": sectors_info,
        "sector_groups": {k: [p["symbol"] for p in v] for k, v in sector_groups.items()},
        "top_picks": top_picks,
        "total_scanned": stage_counts.get("stage2", len(candidates)),
        "pipeline_stages": stage_counts,
    }

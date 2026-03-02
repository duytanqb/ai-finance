"""Stage 4: AI quality gate — sector-aware batch assess + full analysis on top picks."""

import os
from collections.abc import Callable


def _build_sector_context(candidates: list[dict], sector_analysis: dict) -> str:
    """Build sector context string for the AI prompt."""
    sectors = sector_analysis.get("sectors", [])
    if not sectors:
        return "Không có dữ liệu ngành."

    lines = []
    for s in sectors:
        name = s.get("sector_name", "")
        confidence = s.get("confidence", 0)
        thesis = s.get("thesis", "")
        catalysts = ", ".join(s.get("catalysts", []))
        stock_count = sum(1 for c in candidates if c.get("sector_name") == name)
        lines.append(
            f"- {name} (confidence: {confidence}/100, {stock_count} stocks): "
            f"{thesis}. Catalysts: {catalysts}"
        )

    mood = sector_analysis.get("market_mood", "neutral")
    summary = sector_analysis.get("market_summary", "")

    return (
        f"Tâm lý thị trường: {mood}\n"
        f"Tổng quan: {summary}\n\n"
        f"Ngành nóng:\n" + "\n".join(lines)
    )


async def run_deep_research(
    candidates: list[dict],
    sector_analysis: dict | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> list[dict]:
    """Two-tier AI assessment with sector context.

    Tier A: Batch quick-assess ALL candidates with sector awareness (1 API call) → PASS/FAIL
    Tier B: Full analyze_stock() on top 5 PASS stocks (5 API calls)

    Args:
        candidates: Stocks that passed quality gate, with sector metadata.
        sector_analysis: Output from analyze_sectors_from_news().

    Returns:
        Candidates enriched with ai_analysis.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("[AIGate] ANTHROPIC_API_KEY not set, skipping AI gate")
        return [{**c, "ai_analysis": None} for c in candidates]

    from services.ai_workflows import AIWorkflowService

    ai = AIWorkflowService()

    # Tier A: Batch quick assess with sector context
    if on_progress:
        on_progress(f"Đánh giá nhanh {len(candidates)} cổ phiếu...")
    print(f"[AIGate] Tier A: Quick assessing {len(candidates)} candidates...")
    try:
        if sector_analysis:
            sector_ctx = _build_sector_context(candidates, sector_analysis)
            assessed = await ai.quick_assess_batch_with_sectors(candidates, sector_ctx)
        else:
            assessed = await ai.quick_assess_batch(candidates)
    except Exception as e:
        print(f"[AIGate] Batch assess failed: {e}")
        assessed = [{**c, "ai_verdict": "PASS", "ai_priority": 5} for c in candidates]

    passed = [c for c in assessed if c.get("ai_verdict") == "PASS"]
    failed = [c for c in assessed if c.get("ai_verdict") == "FAIL"]
    passed.sort(key=lambda x: x.get("ai_priority", 5), reverse=True)

    print(f"[AIGate] {len(passed)} PASS, {len(failed)} FAIL")
    for f in failed[:5]:
        print(f"  FAIL {f['symbol']}: {f.get('ai_reason', '')}")

    # Tier B: Full comprehensive analysis on top 5 PASS stocks
    top_for_analysis = passed[:5]
    rest = passed[5:]

    enriched = []
    for ai_i, candidate in enumerate(top_for_analysis):
        symbol = candidate["symbol"]
        try:
            if on_progress:
                on_progress(f"Phân tích chuyên sâu {symbol} ({ai_i + 1}/{len(top_for_analysis)})")
            print(f"  [AIGate] Full analysis (chart+financials+news): {symbol}...")
            result = await ai.full_analysis(symbol)
            analysis = result.get("analysis", {})

            # Attach sector metadata to AI analysis
            if isinstance(analysis, dict) and candidate.get("sector_name"):
                analysis["sector_name"] = candidate["sector_name"]
                analysis["sector_thesis"] = candidate.get("sector_thesis", "")
                analysis["sector_alignment"] = candidate.get("sector_alignment", "")

            enriched.append({**candidate, "ai_analysis": analysis})
            action = analysis.get("action", "N/A") if isinstance(analysis, dict) else "N/A"
            confidence = analysis.get("confidence", "N/A") if isinstance(analysis, dict) else "N/A"
            print(f"    {symbol}: {action} (confidence: {confidence}%)")
        except Exception as e:
            print(f"    {symbol}: Full analysis failed - {e}")
            enriched.append({**candidate, "ai_analysis": None})

    # Remaining PASS stocks get WATCH with quick reason + sector info
    for c in rest:
        enriched.append({
            **c,
            "ai_analysis": {
                "action": "WATCH",
                "confidence": 0,
                "summary": c.get("ai_reason", ""),
                "sector_name": c.get("sector_name", ""),
                "sector_thesis": c.get("sector_thesis", ""),
                "sector_alignment": c.get("sector_alignment", ""),
            },
        })

    print(
        f"[AIGate] Done. "
        f"{sum(1 for e in enriched if e.get('ai_analysis') and e['ai_analysis'].get('confidence', 0) > 0)} "
        f"fully analyzed"
    )
    return enriched

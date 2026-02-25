"""Step 3: AI analysis for top candidates."""

import os


async def run_deep_research(candidates: list[dict]) -> list[dict]:
    """Run AI analysis on top 3 candidates.

    Args:
        candidates: Enriched list from news_fetch.

    Returns:
        Candidates with ai_analysis attached (top 3 only).
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("[DeepResearch] ANTHROPIC_API_KEY not set, skipping AI analysis")
        return [{**c, "ai_analysis": None} for c in candidates]

    print(f"[DeepResearch] Running AI analysis on top 3 of {len(candidates)} candidates...")

    from services.ai_workflows import AIWorkflowService

    ai = AIWorkflowService()
    top_3 = candidates[:3]
    rest = candidates[3:]

    enriched = []
    for candidate in top_3:
        symbol = candidate["symbol"]
        try:
            print(f"  Analyzing {symbol}...")
            result = await ai.analyze_stock(symbol)
            analysis = result.get("analysis", {})
            enriched.append({**candidate, "ai_analysis": analysis})
            print(f"  {symbol}: {analysis.get('action', 'N/A')} (confidence: {analysis.get('confidence', 'N/A')}%)")
        except Exception as e:
            print(f"  {symbol}: AI analysis failed - {e}")
            enriched.append({**candidate, "ai_analysis": None})

    # Keep rest without AI analysis
    for candidate in rest:
        enriched.append({**candidate, "ai_analysis": None})

    print(f"[DeepResearch] Done. {sum(1 for c in enriched if c.get('ai_analysis'))} stocks analyzed")
    return enriched

"""Stock suggestions pipeline: cross-reference YouTube + News + Funds → Deep Research → BUY list."""

import logging
import os
from datetime import datetime, timedelta

import httpx

logger = logging.getLogger(__name__)

APP_URL = os.environ.get("APP_URL", "http://localhost:3000")


async def run_stock_suggestions() -> dict | None:
    from routers.stock_suggestions import (
        _start_stage,
        complete_stage,
        set_pipeline_status,
        update_progress,
    )
    from services.ai_workflows import AIWorkflowService

    set_pipeline_status("running")
    now = datetime.now()
    batch_date = now.strftime("%Y-%m-%d")

    logger.info("=" * 60)
    logger.info("[Suggestions] Starting pipeline at %s", now)
    logger.info("=" * 60)

    try:
        # ── Stage 1: Collect stock mentions from all sources ──
        _start_stage(1, "Thu thập dữ liệu")
        update_progress(1, "Thu thập dữ liệu", "Đang thu thập từ YouTube, tin tức, quỹ đầu tư...")
        mentions = await _collect_mentions()
        complete_stage(
            1,
            "Thu thập dữ liệu",
            f"Tìm thấy {len(mentions)} mã từ {_count_sources(mentions)} nguồn",
        )
        logger.info("[Suggestions] Stage 1: %d stock mentions collected", len(mentions))

        if not mentions:
            logger.info("[Suggestions] No mentions found, aborting")
            set_pipeline_status("completed")
            return {"batch_date": batch_date, "suggestions": []}

        # ── Stage 2: Score & rank candidates ──
        _start_stage(2, "Chấm điểm & xếp hạng")
        update_progress(2, "Chấm điểm & xếp hạng", "Đang tính điểm đa nguồn...")
        scored = _score_and_rank(mentions)
        recently_researched = await _get_recently_researched(days=3)
        candidates = [
            s for s in scored if s["symbol"] not in recently_researched
        ][:8]
        complete_stage(
            2,
            "Chấm điểm & xếp hạng",
            f"Top {len(candidates)} ứng viên (loại {len(recently_researched)} đã phân tích)",
        )
        logger.info(
            "[Suggestions] Stage 2: %d candidates after scoring (skipped %d recent)",
            len(candidates),
            len(recently_researched),
        )

        if not candidates:
            logger.info("[Suggestions] No candidates after filtering")
            set_pipeline_status("completed")
            return {"batch_date": batch_date, "suggestions": []}

        # ── Stage 3: Deep research each candidate ──
        _start_stage(3, "Deep Research")
        ai = AIWorkflowService()
        researched = []
        for i, cand in enumerate(candidates):
            symbol = cand["symbol"]
            update_progress(
                3,
                "Deep Research",
                f"Đang phân tích {symbol} ({i + 1}/{len(candidates)})...",
            )
            try:
                result = await ai.deep_research(symbol)
                report_text = result.get("report", "")

                report_id = await _save_report(symbol, report_text)

                rec = await ai.extract_recommendation(symbol, report_text)
                cand["recommendation"] = rec.get("recommendation", "HOLD")
                cand["confidence"] = rec.get("confidence", 50)
                cand["target_price"] = rec.get("target_price")
                cand["entry_price"] = rec.get("entry_price")
                cand["stop_loss"] = rec.get("stop_loss")
                cand["deep_research_summary"] = rec.get("summary", "")
                cand["deep_research_report_id"] = report_id
                researched.append(cand)
                logger.info(
                    "[Suggestions] Deep research %s: %s (confidence=%d)",
                    symbol,
                    cand["recommendation"],
                    cand["confidence"],
                )
            except Exception as e:
                logger.warning("[Suggestions] Deep research failed for %s: %s", symbol, e)

        complete_stage(
            3,
            "Deep Research",
            f"Phân tích xong {len(researched)}/{len(candidates)} mã",
        )

        # ── Stage 4: Filter BUY + save ──
        _start_stage(4, "Lọc & lưu kết quả")
        update_progress(4, "Lọc & lưu kết quả", "Đang lọc khuyến nghị MUA...")
        approved = [
            r
            for r in researched
            if r.get("recommendation", "").upper() == "BUY"
            and r.get("confidence", 0) >= 60
        ]

        for s in approved:
            s["status"] = "approved"
            s["batch_date"] = batch_date

        for s in researched:
            if s not in approved:
                s["status"] = "rejected"
                s["batch_date"] = batch_date

        all_suggestions = approved + [s for s in researched if s["status"] == "rejected"]
        await _save_suggestions(all_suggestions)

        complete_stage(
            4,
            "Lọc & lưu kết quả",
            f"{len(approved)} mã khuyến nghị MUA / {len(researched)} đã phân tích",
        )

        set_pipeline_status("completed")
        logger.info(
            "[Suggestions] Pipeline completed: %d approved out of %d researched",
            len(approved),
            len(researched),
        )
        return {
            "batch_date": batch_date,
            "suggestions": all_suggestions,
            "approved_count": len(approved),
        }

    except Exception as e:
        logger.error("[Suggestions] Pipeline failed: %s", e)
        set_pipeline_status("error", str(e))
        return None


async def _collect_mentions() -> dict[str, dict]:
    """Collect stock mentions from all sources into {symbol: {score, sources}}."""
    mentions: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=15) as client:
        # YouTube videos
        try:
            resp = await client.get(f"{APP_URL}/api/youtube/videos?recent=true")
            if resp.status_code == 200:
                videos = resp.json().get("videos", [])
                for v in videos:
                    summary = v if isinstance(v, dict) else {}
                    stocks = summary.get("stocks_mentioned", [])
                    if not stocks and "summary" in summary and isinstance(summary["summary"], dict):
                        stocks = summary["summary"].get("stocks_mentioned", [])
                    for s in stocks:
                        sym = (s.get("symbol") or "").upper().strip()
                        if not sym or len(sym) > 5:
                            continue
                        if sym not in mentions:
                            mentions[sym] = {"sources": [], "sentiment_bonus": 0}
                        mentions[sym]["sources"].append({
                            "type": "youtube_video",
                            "channel": v.get("channel_name", summary.get("channel_name", "")),
                            "sentiment": s.get("sentiment", "neutral"),
                            "context": s.get("context", ""),
                        })
                        if s.get("sentiment") == "bullish":
                            mentions[sym]["sentiment_bonus"] += 0.5
                logger.info("[Suggestions] YouTube videos: extracted mentions from %d videos", len(videos))
        except Exception as e:
            logger.warning("[Suggestions] Failed to fetch YouTube videos: %s", e)

        # YouTube digest consensus
        try:
            resp = await client.get(f"{APP_URL}/api/youtube/digest")
            if resp.status_code == 200:
                data = resp.json()
                digest = data.get("digest", {})
                if isinstance(digest, dict):
                    consensus = digest.get("consensus_stocks", [])
                    for s in consensus:
                        sym = (s.get("symbol") or "").upper().strip()
                        if not sym or len(sym) > 5:
                            continue
                        if sym not in mentions:
                            mentions[sym] = {"sources": [], "sentiment_bonus": 0}
                        mentions[sym]["sources"].append({
                            "type": "youtube_consensus",
                            "mentions": s.get("mentions", 1),
                            "sentiment": s.get("avg_sentiment", "neutral"),
                        })
                        if s.get("avg_sentiment") == "bullish":
                            mentions[sym]["sentiment_bonus"] += 0.5
                    logger.info("[Suggestions] YouTube digest: %d consensus stocks", len(consensus))
        except Exception as e:
            logger.warning("[Suggestions] Failed to fetch YouTube digest: %s", e)

        # Market Watch top picks
        try:
            resp = await client.get(f"{APP_URL}/api/stocks/market-watch")
            if resp.status_code == 200:
                data = resp.json()
                picks = data.get("top_picks", [])
                for p in picks:
                    sym = (p.get("symbol") or "").upper().strip()
                    if not sym:
                        continue
                    if sym not in mentions:
                        mentions[sym] = {"sources": [], "sentiment_bonus": 0}
                    mentions[sym]["sources"].append({
                        "type": "market_watch",
                        "action": p.get("action", ""),
                        "confidence": p.get("confidence", 0),
                        "sector": p.get("sector_name", ""),
                    })
                    mentions[sym].setdefault("name", p.get("name", ""))
                    mentions[sym].setdefault("exchange", p.get("exchange", ""))
                logger.info("[Suggestions] Market Watch: %d top picks", len(picks))
        except Exception as e:
            logger.warning("[Suggestions] Failed to fetch Market Watch: %s", e)

        # Fund smart money
        try:
            resp = await client.post(
                f"{APP_URL}/api/fund/smart-money",
                json={"top_n": 20, "min_return_12m": 3.0},
            )
            if resp.status_code == 200:
                data = resp.json()
                consensus = data.get("consensus", data.get("stocks", []))
                for s in consensus:
                    sym = (s.get("symbol") or s.get("stock_code") or "").upper().strip()
                    if not sym or len(sym) > 5:
                        continue
                    if sym not in mentions:
                        mentions[sym] = {"sources": [], "sentiment_bonus": 0}
                    mentions[sym]["sources"].append({
                        "type": "fund_holding",
                        "fund_count": s.get("fund_count", 1),
                        "avg_weight": s.get("avg_weight", 0),
                        "funds": s.get("funds", []),
                    })
                logger.info("[Suggestions] Fund smart money: %d stocks", len(consensus))
        except Exception as e:
            logger.warning("[Suggestions] Failed to fetch fund data: %s", e)

    return mentions


def _count_sources(mentions: dict[str, dict]) -> int:
    source_types = set()
    for m in mentions.values():
        for s in m.get("sources", []):
            source_types.add(s.get("type", ""))
    return len(source_types)


def _score_and_rank(mentions: dict[str, dict]) -> list[dict]:
    """Score each stock based on source weights and sort descending."""
    WEIGHTS = {
        "fund_holding": 3.0,
        "youtube_consensus": 2.0,
        "market_watch": 1.5,
        "youtube_video": 1.0,
    }

    scored = []
    for symbol, data in mentions.items():
        score = 0.0
        for src in data.get("sources", []):
            weight = WEIGHTS.get(src.get("type", ""), 1.0)
            if src.get("type") == "fund_holding":
                weight *= min(src.get("fund_count", 1), 5)
            score += weight
        score += data.get("sentiment_bonus", 0)

        scored.append({
            "symbol": symbol,
            "name": data.get("name", ""),
            "exchange": data.get("exchange", ""),
            "score": round(score, 1),
            "sources": data.get("sources", []),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


async def _get_recently_researched(days: int = 3) -> set[str]:
    """Get symbols that were deep-researched in the last N days."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{APP_URL}/api/reports?type=deep_research&days={days}")
            if resp.status_code == 200:
                data = resp.json()
                reports = data.get("reports", [])
                return {r.get("symbol", "").upper() for r in reports if r.get("symbol")}
    except Exception as e:
        logger.warning("[Suggestions] Failed to fetch recent reports: %s", e)
    return set()


async def _save_report(symbol: str, report_text: str) -> str | None:
    """Save deep research report to DB and return report ID."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{APP_URL}/api/reports",
                json={
                    "symbol": symbol.upper(),
                    "reportType": "deep_research",
                    "result": {"report": report_text},
                    "model": "opus",
                },
            )
            if resp.status_code < 300:
                data = resp.json()
                return data.get("id")
    except Exception as e:
        logger.warning("[Suggestions] Failed to save report for %s: %s", symbol, e)
    return None


async def _save_suggestions(suggestions: list[dict]) -> None:
    """Save suggestions to DB via Next.js API."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{APP_URL}/api/stock-suggestions",
                json={"suggestions": suggestions},
            )
            if resp.status_code < 300:
                logger.info("[Suggestions] Saved %d suggestions to DB", len(suggestions))
            else:
                logger.warning("[Suggestions] Save failed: HTTP %d", resp.status_code)
    except Exception as e:
        logger.warning("[Suggestions] Failed to save suggestions: %s", e)

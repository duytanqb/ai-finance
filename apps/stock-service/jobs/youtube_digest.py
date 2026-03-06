"""YouTube digest pipeline: crawl channels → transcripts → AI summaries → daily digest."""

import asyncio
import logging
import os
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

APP_URL = os.environ.get("APP_URL", "http://localhost:3000")


async def run_youtube_digest(since_hours: int = 48) -> dict | None:
    """Run the full YouTube digest pipeline."""
    from routers.youtube import complete_stage, update_progress, _start_stage, set_pipeline_status
    from services.ai_workflows import AIWorkflowService
    from services.youtube_crawler import YouTubeCrawler

    set_pipeline_status("running")
    now = datetime.now()

    logger.info("=" * 60)
    logger.info("[YouTube] Starting digest pipeline at %s", now)
    logger.info("=" * 60)

    try:
        # Stage 1: Fetch processed video IDs from DB
        _start_stage(1, "Kiểm tra video đã xử lý")
        update_progress(1, "Kiểm tra video đã xử lý", "Đang lấy danh sách video đã phân tích...")
        processed_ids = await _fetch_processed_video_ids()
        complete_stage(1, "Kiểm tra video đã xử lý", f"Đã có {len(processed_ids)} video trong DB")
        logger.info("[YouTube] Stage 1: %d videos already processed", len(processed_ids))

        # Stage 2: Crawl channels for new videos
        _start_stage(2, "Thu thập video mới")
        update_progress(2, "Thu thập video mới", "Đang quét các kênh YouTube...")
        crawler = YouTubeCrawler()
        new_videos = await crawler.crawl_all_channels(
            processed_video_ids=processed_ids,
            since_hours=since_hours,
        )
        complete_stage(2, "Thu thập video mới", f"Tìm thấy {len(new_videos)} video mới có transcript")
        logger.info("[YouTube] Stage 2: %d new videos with transcripts", len(new_videos))

        if not new_videos:
            logger.info("[YouTube] No new videos found, skipping AI analysis")
            set_pipeline_status("completed")
            return {"date": now.strftime("%Y-%m-%d"), "videos_processed": 0}

        # Stage 3: AI summarize each video
        _start_stage(3, "AI tóm tắt video")
        ai = AIWorkflowService()
        video_summaries = []
        for i, video in enumerate(new_videos):
            update_progress(
                3, "AI tóm tắt video",
                f"Đang phân tích video {i + 1}/{len(new_videos)}: {video['title'][:50]}...",
            )
            try:
                summary = await ai.summarize_video(video)
                video_summaries.append(summary)
                logger.info("[YouTube] Summarized: %s", video["title"][:60])
            except Exception as e:
                logger.warning("[YouTube] Failed to summarize %s: %s", video["video_id"], e)

        complete_stage(3, "AI tóm tắt video", f"Đã tóm tắt {len(video_summaries)}/{len(new_videos)} video")

        # Stage 4: Cross-reference into unified digest
        _start_stage(4, "Tổng hợp nhận định")
        update_progress(4, "Tổng hợp nhận định", "AI đang đối chiếu nhận định từ các kênh...")
        digest = await ai.youtube_market_digest(video_summaries)
        complete_stage(4, "Tổng hợp nhận định", "Hoàn thành tổng hợp thị trường")
        logger.info("[YouTube] Stage 4: Digest generated")

        # Stage 5: Save to DB
        _start_stage(5, "Lưu kết quả")
        update_progress(5, "Lưu kết quả", "Đang lưu video và digest vào database...")

        # Save each video
        for vs in video_summaries:
            await _save_video(vs)

        # Save daily digest
        digest_payload = {
            "date": now.strftime("%Y-%m-%d"),
            "generated_at": now.isoformat(),
            "digest": digest,
            "videos_processed": len(video_summaries),
            "video_summaries": video_summaries,
        }
        await _save_digest(digest_payload)
        complete_stage(5, "Lưu kết quả", f"Đã lưu {len(video_summaries)} video + 1 digest")

        set_pipeline_status("completed")
        logger.info("[YouTube] Pipeline completed: %d videos processed", len(video_summaries))
        return digest_payload

    except Exception as e:
        logger.error("[YouTube] Pipeline failed: %s", e)
        set_pipeline_status("error", str(e))
        return None


async def _fetch_processed_video_ids() -> set[str]:
    """Fetch already-processed video IDs from DB."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{APP_URL}/api/youtube/videos?ids_only=true")
            if resp.status_code == 200:
                data = resp.json()
                return set(data.get("video_ids", []))
    except Exception as e:
        logger.warning("[YouTube] Failed to fetch processed IDs: %s", e)
    return set()


async def _save_video(video_summary: dict) -> None:
    """Save a processed video record to DB."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{APP_URL}/api/youtube/videos", json=video_summary)
            if resp.status_code >= 300:
                logger.warning("[YouTube] Failed to save video %s: HTTP %d", video_summary.get("video_id"), resp.status_code)
    except Exception as e:
        logger.warning("[YouTube] Failed to save video: %s", e)


async def _save_digest(digest: dict) -> None:
    """Save daily digest to DB."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{APP_URL}/api/youtube/digest", json=digest)
            if resp.status_code < 300:
                logger.info("[YouTube] Digest saved to DB")
            else:
                logger.warning("[YouTube] Digest save failed: HTTP %d", resp.status_code)
    except Exception as e:
        logger.warning("[YouTube] Digest save failed: %s", e)

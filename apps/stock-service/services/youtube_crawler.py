"""YouTube channel crawler for Vietnam finance content."""

import asyncio
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import httpx
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
}

YT_RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

ATOM_NS = "{http://www.w3.org/2005/Atom}"
MEDIA_NS = "{http://search.yahoo.com/mrss/}"

CHANNELS: list[dict] = [
    {"channel_id": "UCnMxLNXPsYJmdMwP4WxhANw", "name": "Ichimoku Đầu Tư", "category": "technical"},
    {"channel_id": "UCt7vdOZp7dXqnJc14lyW7Lg", "name": "NVT Vietnam", "category": "analysis"},
    {"channel_id": "UCu3q59AXNNDGxT9LUBQeELA", "name": "TuaTS", "category": "analysis"},
    {"channel_id": "UC8EpusiPDtdVN_WRGvhBBqg", "name": "Chứng khoán TVI", "category": "analysis"},
    {"channel_id": "UCDJIGO_3ycJAKLPv7Yh396A", "name": "Thai Pham", "category": "macro"},
]


class YouTubeCrawler:
    def __init__(self) -> None:
        self._ytt_api = YouTubeTranscriptApi()

    async def fetch_recent_videos(
        self,
        channel_id: str,
        channel_name: str,
        since_hours: int = 48,
    ) -> list[dict]:
        """Fetch recent videos from a channel's RSS feed."""
        url = YT_RSS_URL.format(channel_id=channel_id)
        cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=since_hours)

        try:
            async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
                resp = await client.get(url)
                resp.raise_for_status()
        except Exception as e:
            logger.warning("Failed to fetch RSS for %s: %s", channel_name, e)
            return []

        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as e:
            logger.warning("Failed to parse RSS XML for %s: %s", channel_name, e)
            return []

        videos: list[dict] = []
        for entry in root.findall(f"{ATOM_NS}entry"):
            video_id_el = entry.find(f"{ATOM_NS}id")
            title_el = entry.find(f"{ATOM_NS}title")
            published_el = entry.find(f"{ATOM_NS}published")
            thumbnail_el = entry.find(f"{MEDIA_NS}group/{MEDIA_NS}thumbnail")

            if video_id_el is None or title_el is None or published_el is None:
                continue

            video_id_text = video_id_el.text or ""
            video_id = video_id_text.replace("yt:video:", "")
            title = title_el.text or ""

            published_str = published_el.text or ""
            try:
                published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            except ValueError:
                continue

            if published_at < cutoff:
                continue

            thumbnail_url = ""
            if thumbnail_el is not None:
                thumbnail_url = thumbnail_el.get("url", "")

            videos.append({
                "video_id": video_id,
                "title": title,
                "channel_name": channel_name,
                "published_at": published_at.isoformat(),
                "thumbnail_url": thumbnail_url,
            })

        logger.info(
            "Found %d recent videos from %s (since %dh ago)",
            len(videos),
            channel_name,
            since_hours,
        )
        return videos

    def get_transcript(
        self,
        video_id: str,
        languages: list[str] | None = None,
    ) -> tuple[str | None, int]:
        """Get transcript text for a video.

        Returns (transcript_text, duration_minutes).
        Returns (None, 0) if no transcript available.
        """
        if languages is None:
            languages = ["vi", "en"]

        try:
            transcript = self._ytt_api.fetch(video_id, languages=languages)
            snippets = list(transcript)
            if not snippets:
                return None, 0

            text = " ".join(s.text for s in snippets)
            last = snippets[-1]
            duration_min = int((last.start + last.duration) / 60)
            return text, duration_min
        except Exception as e:
            logger.warning("No transcript for video %s: %s", video_id, e)
            return None, 0

    async def crawl_all_channels(
        self,
        processed_video_ids: set[str] | None = None,
        since_hours: int = 48,
    ) -> list[dict]:
        """Crawl all configured channels for new videos with transcripts.

        Args:
            processed_video_ids: Set of video IDs already in DB (skip these).
            since_hours: Only fetch videos published within this window.

        Returns list of dicts with video metadata + transcript text.
        """
        if processed_video_ids is None:
            processed_video_ids = set()

        if not CHANNELS:
            logger.warning("No YouTube channels configured")
            return []

        tasks = [
            self.fetch_recent_videos(ch["channel_id"], ch["name"], since_hours)
            for ch in CHANNELS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_videos: list[dict] = []
        for result in results:
            if isinstance(result, Exception):
                logger.warning("Channel crawl failed: %s", result)
                continue
            all_videos.extend(result)

        new_videos = [v for v in all_videos if v["video_id"] not in processed_video_ids]
        logger.info(
            "Total videos found: %d, new (not processed): %d",
            len(all_videos),
            len(new_videos),
        )

        videos_with_transcripts: list[dict] = []
        for video in new_videos:
            transcript, duration = await asyncio.to_thread(
                self.get_transcript, video["video_id"]
            )
            if transcript:
                video["transcript"] = transcript
                video["duration_minutes"] = duration
                videos_with_transcripts.append(video)
            else:
                logger.info("Skipping video %s (no transcript)", video["video_id"])

        logger.info(
            "Videos with transcripts ready for AI: %d",
            len(videos_with_transcripts),
        )
        return videos_with_transcripts

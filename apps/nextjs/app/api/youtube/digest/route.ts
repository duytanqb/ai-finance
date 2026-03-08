import { db, desc } from "@packages/drizzle";
import {
  watchlistItem,
  youtubeDigest,
  youtubeVideo,
} from "@packages/drizzle/schema";
import { NextResponse } from "next/server";
import { stockServicePost } from "@/lib/stock-service";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(youtubeDigest)
      .orderBy(desc(youtubeDigest.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ digest: null });
    }

    const latest = rows[0];
    if (!latest) {
      return NextResponse.json({ digest: null });
    }

    const videos = await db
      .select()
      .from(youtubeVideo)
      .orderBy(desc(youtubeVideo.processedAt))
      .limit(20);

    return NextResponse.json({
      id: latest.id,
      date: latest.date,
      generated_at: latest.generatedAt?.toISOString(),
      digest: latest.digest,
      videos_processed: latest.videosProcessed,
      video_summaries: videos
        .filter((v) => v.summary)
        .map((v) => ({
          video_id: v.videoId,
          title: v.title,
          channel_name: v.channelName,
          published_at: v.publishedAt?.toISOString(),
          thumbnail_url: v.thumbnailUrl,
          duration_minutes: v.durationMinutes,
          ...(v.summary as Record<string, unknown>),
        })),
      cached: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.digest && body.date) {
      await db.insert(youtubeDigest).values({
        date: body.date as string,
        generatedAt: new Date(body.generated_at || new Date()),
        digest: body.digest,
        videosProcessed: (body.videos_processed as number) || 0,
      });

      // Auto-add YouTube consensus stocks to all users' watchlists
      const digest = body.digest as Record<string, unknown>;
      const consensusStocks = (digest.consensus_stocks || []) as {
        symbol: string;
      }[];
      if (consensusStocks.length > 0) {
        const { user } = await import("@packages/drizzle/schema");
        const users = await db.select({ id: user.id }).from(user);
        const inserts = users.flatMap((u) =>
          consensusStocks
            .filter((s) => s.symbol)
            .map((s) => ({
              id: crypto.randomUUID(),
              userId: u.id,
              symbol: s.symbol.toUpperCase(),
              notes: "YouTube consensus",
            })),
        );
        if (inserts.length > 0) {
          await db.insert(watchlistItem).values(inserts).onConflictDoNothing();
        }
      }

      return NextResponse.json({ ok: true });
    }

    const result = await stockServicePost("/api/youtube/digest", body);
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to save/trigger digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

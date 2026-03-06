import { db, desc } from "@packages/drizzle";
import { youtubeVideo } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsOnly = searchParams.get("ids_only") === "true";

  try {
    if (idsOnly) {
      const rows = await db
        .select({ videoId: youtubeVideo.videoId })
        .from(youtubeVideo);
      return NextResponse.json({
        video_ids: rows.map((r) => r.videoId),
      });
    }

    const rows = await db
      .select()
      .from(youtubeVideo)
      .orderBy(desc(youtubeVideo.processedAt))
      .limit(100);

    return NextResponse.json({ videos: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch videos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const videoId = body.video_id as string;
    if (!videoId) {
      return NextResponse.json(
        { error: "video_id is required" },
        { status: 400 },
      );
    }

    await db
      .insert(youtubeVideo)
      .values({
        videoId,
        channelName: (body.channel_name as string) || "Unknown",
        title: (body.title as string) || "",
        publishedAt: body.published_at ? new Date(body.published_at) : null,
        thumbnailUrl: (body.thumbnail_url as string) || null,
        durationMinutes: (body.duration_minutes as number) || null,
        summary: body,
      })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

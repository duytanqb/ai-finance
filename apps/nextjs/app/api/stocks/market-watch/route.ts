import { db } from "@packages/drizzle/config";
import { marketWatchDigest } from "@packages/drizzle/schema/stock";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stockServiceGet, stockServicePost } from "@/lib/stock-service";

interface DigestPayload {
  date: string;
  generated_at: string;
  market_summary: string;
  top_picks: unknown[];
  total_scanned: number;
  market_mood?: string;
  sector_analysis?: unknown[];
  sector_groups?: Record<string, string[]>;
  pipeline_type?: string;
}

async function saveDigest(data: DigestPayload) {
  await db.insert(marketWatchDigest).values({
    date: data.date,
    generatedAt: new Date(data.generated_at),
    marketSummary: data.market_summary,
    topPicks: data.top_picks,
    totalScanned: data.total_scanned,
    marketMood: data.market_mood ?? null,
    sectorAnalysis: data.sector_analysis ?? null,
    sectorGroups: data.sector_groups ?? null,
    pipelineType: data.pipeline_type ?? null,
  });
}

function formatDigest(row: typeof marketWatchDigest.$inferSelect) {
  return {
    date: row.date,
    generated_at: row.generatedAt.toISOString(),
    market_summary: row.marketSummary,
    top_picks: row.topPicks,
    total_scanned: row.totalScanned,
    market_mood: row.marketMood,
    sector_analysis: row.sectorAnalysis,
    sector_groups: row.sectorGroups,
    pipeline_type: row.pipelineType,
    cached: true,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkStatus = searchParams.get("status");

  // Poll pipeline status from Python service
  if (checkStatus === "1") {
    try {
      const status = (await stockServiceGet(
        "/api/market-watch/status",
      )) as Record<string, unknown>;

      if (status.status === "completed" && status.digest) {
        const digest = status.digest as DigestPayload;
        if (digest.top_picks?.length) {
          await saveDigest(digest);
        }
        return NextResponse.json({ ...digest, pipeline_status: "completed" });
      }

      return NextResponse.json({
        pipeline_status: status.status,
        started_at: status.started_at,
        error: status.error,
        current_stage: status.current_stage,
        current_stage_name: status.current_stage_name,
        stage_detail: status.stage_detail,
        stages: status.stages,
      });
    } catch (e) {
      return NextResponse.json({
        pipeline_status: "error",
        error: e instanceof Error ? e.message : "Failed to check status",
      });
    }
  }

  // Default: return latest digest from DB
  try {
    const [latest] = await db
      .select()
      .from(marketWatchDigest)
      .orderBy(desc(marketWatchDigest.createdAt))
      .limit(1);

    if (latest) {
      return NextResponse.json(formatDigest(latest));
    }

    const data = (await stockServiceGet("/api/market-watch/latest")) as
      | DigestPayload
      | undefined;
    if (data?.top_picks?.length) {
      await saveDigest(data);
      return NextResponse.json(data);
    }

    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      generated_at: new Date().toISOString(),
      market_summary:
        "Chưa có dữ liệu. Nhấn 'Làm mới' để chạy phân tích lần đầu.",
      top_picks: [],
      total_scanned: 0,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load market watch";
    return NextResponse.json(
      { error: message, top_picks: [] },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Mode 1: Direct save from Python cron callback
    if (body.top_picks && body.date) {
      await saveDigest(body as DigestPayload);
      return NextResponse.json({ saved: true });
    }

    // Mode 2: Manual refresh — trigger async pipeline on Python
    const result = (await stockServicePost(
      "/api/market-watch/digest",
    )) as Record<string, unknown>;

    return NextResponse.json({
      pipeline_status: result.status,
      started_at: result.started_at,
      message: "Pipeline đang chạy. Dữ liệu sẽ cập nhật trong vài phút.",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to trigger refresh";
    return NextResponse.json(
      { error: message, pipeline_status: "error" },
      { status: 503 },
    );
  }
}

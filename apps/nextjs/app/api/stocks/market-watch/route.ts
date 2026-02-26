import { db } from "@packages/drizzle/config";
import { marketWatchDigest } from "@packages/drizzle/schema/stock";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface DigestPayload {
  date: string;
  generated_at: string;
  market_summary: string;
  top_picks: unknown[];
  total_scanned: number;
}

async function saveDigest(data: DigestPayload) {
  await db.insert(marketWatchDigest).values({
    date: data.date,
    generatedAt: new Date(data.generated_at),
    marketSummary: data.market_summary,
    topPicks: data.top_picks,
    totalScanned: data.total_scanned,
  });
}

function formatDigest(row: typeof marketWatchDigest.$inferSelect) {
  return {
    date: row.date,
    generated_at: row.generatedAt.toISOString(),
    market_summary: row.marketSummary,
    top_picks: row.topPicks,
    total_scanned: row.totalScanned,
    cached: true,
  };
}

export async function GET() {
  try {
    const [latest] = await db
      .select()
      .from(marketWatchDigest)
      .orderBy(desc(marketWatchDigest.createdAt))
      .limit(1);

    if (latest) {
      return NextResponse.json(formatDigest(latest));
    }

    // No data in DB — try to get from Python service
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
      market_summary: "No digest available yet. Click Refresh to generate.",
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

    // Mode 2: Manual refresh — trigger Python pipeline
    const data = (await stockServiceGet("/api/market-watch/digest")) as
      | DigestPayload
      | undefined;
    if (data?.top_picks) {
      await saveDigest(data);
    }
    return NextResponse.json(
      data ?? { error: "No data returned", top_picks: [] },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to refresh market watch";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

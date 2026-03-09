import { db } from "@packages/drizzle/config";
import { marketWatchDigest } from "@packages/drizzle/schema/stock";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [latest] = await db
      .select({
        marketMood: marketWatchDigest.marketMood,
        marketSummary: marketWatchDigest.marketSummary,
        generatedAt: marketWatchDigest.generatedAt,
        headlines: marketWatchDigest.headlines,
        sectorAnalysis: marketWatchDigest.sectorAnalysis,
      })
      .from(marketWatchDigest)
      .orderBy(desc(marketWatchDigest.createdAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ market_mood: null, important_news: [] });
    }

    return NextResponse.json({
      market_mood: latest.marketMood,
      market_summary: latest.marketSummary,
      generated_at: latest.generatedAt?.toISOString(),
      important_news: latest.headlines ?? [],
      sector_analysis: latest.sectorAnalysis ?? [],
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch market news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

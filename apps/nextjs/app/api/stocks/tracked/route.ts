import { db, desc, eq } from "@packages/drizzle";
import { analysisReport, watchlistItem } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ tracked: [] });
  }

  const userId = guard.session.user.id;

  try {
    // Get all unique symbols the user has analyzed (most recent first)
    const reports = await db
      .select({
        symbol: analysisReport.symbol,
        reportType: analysisReport.reportType,
        createdAt: analysisReport.createdAt,
      })
      .from(analysisReport)
      .where(eq(analysisReport.userId, userId))
      .orderBy(desc(analysisReport.createdAt))
      .limit(100);

    // Deduplicate — keep latest report per symbol
    const symbolMap = new Map<
      string,
      { reportType: string; analyzedAt: string }
    >();
    for (const r of reports) {
      if (!symbolMap.has(r.symbol)) {
        symbolMap.set(r.symbol, {
          reportType: r.reportType,
          analyzedAt: r.createdAt.toISOString(),
        });
      }
    }

    // Get MA50 signals from watchlist
    const watchlistRows = await db
      .select({
        symbol: watchlistItem.symbol,
        aiReview: watchlistItem.aiReview,
        targetPrice: watchlistItem.targetPrice,
        aiReviewedAt: watchlistItem.aiReviewedAt,
      })
      .from(watchlistItem)
      .where(eq(watchlistItem.userId, userId));

    const signalMap = new Map<string, Record<string, unknown>>();
    for (const row of watchlistRows) {
      if (row.aiReview) {
        signalMap.set(row.symbol, {
          ...(row.aiReview as Record<string, unknown>),
          targetPrice: row.targetPrice,
          aiReviewedAt: row.aiReviewedAt?.toISOString(),
        });
      }
    }

    // Build tracked list
    const tracked = Array.from(symbolMap.entries()).map(
      ([symbol, { reportType, analyzedAt }]) => ({
        symbol,
        source: reportType,
        analyzedAt,
        inWatchlist: watchlistRows.some((w) => w.symbol === symbol),
        ma50Signal: signalMap.get(symbol) || null,
      }),
    );

    // Also add watchlist-only items (from YouTube consensus, etc.) not in reports
    for (const row of watchlistRows) {
      if (!symbolMap.has(row.symbol)) {
        tracked.push({
          symbol: row.symbol,
          source: "watchlist",
          analyzedAt: "",
          inWatchlist: true,
          ma50Signal: signalMap.get(row.symbol) || null,
        });
      }
    }

    return NextResponse.json({ tracked });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch tracked stocks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

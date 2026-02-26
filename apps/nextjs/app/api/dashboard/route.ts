import { count, db, desc, eq } from "@packages/drizzle";
import {
  analysisReport,
  portfolioHolding,
  watchlistItem,
} from "@packages/drizzle/schema";
import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";

export async function GET(_request: NextRequest) {
  try {
    const guardResult = await authGuard();
    const userId = guardResult.authenticated
      ? guardResult.session.user.id
      : null;

    const [portfolioCount, watchlistCount, recentReports] = await Promise.all([
      userId
        ? db
            .select({ count: count() })
            .from(portfolioHolding)
            .where(eq(portfolioHolding.userId, userId))
            .then((r) => r[0]?.count ?? 0)
        : Promise.resolve(0),
      userId
        ? db
            .select({ count: count() })
            .from(watchlistItem)
            .where(eq(watchlistItem.userId, userId))
            .then((r) => r[0]?.count ?? 0)
        : Promise.resolve(0),
      userId
        ? db
            .select({
              id: analysisReport.id,
              symbol: analysisReport.symbol,
              reportType: analysisReport.reportType,
              result: analysisReport.result,
              model: analysisReport.model,
              createdAt: analysisReport.createdAt,
            })
            .from(analysisReport)
            .where(eq(analysisReport.userId, userId))
            .orderBy(desc(analysisReport.createdAt))
            .limit(5)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      portfolio: { count: portfolioCount },
      watchlist: { count: watchlistCount },
      recentReports,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch dashboard data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

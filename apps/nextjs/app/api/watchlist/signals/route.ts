import { db } from "@packages/drizzle";
import { watchlistItem } from "@packages/drizzle/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { stockServicePost } from "@/lib/stock-service";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ signals: {} });
  }

  try {
    const rows = await db
      .select({
        symbol: watchlistItem.symbol,
        aiReview: watchlistItem.aiReview,
      })
      .from(watchlistItem)
      .where(
        and(
          eq(watchlistItem.userId, guard.session.user.id),
          isNotNull(watchlistItem.aiReview),
        ),
      );

    const signals: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.aiReview) {
        signals[row.symbol] = row.aiReview;
      }
    }
    return NextResponse.json({ signals });
  } catch {
    return NextResponse.json({ signals: {} });
  }
}

interface SignalResult {
  symbol: string;
  suggested_buy_price?: number | null;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const results: SignalResult[] = body.results || [];
    const now = new Date();

    // Save to DB for all users who have these symbols in their watchlist
    const updates: Promise<unknown>[] = [];
    for (const r of results) {
      if (!r.symbol) continue;
      const setData: Record<string, unknown> = {
        aiReview: r,
        aiReviewedAt: now,
      };
      if (r.suggested_buy_price != null && r.suggested_buy_price > 0) {
        setData.targetPrice = r.suggested_buy_price;
      }
      updates.push(
        db
          .update(watchlistItem)
          .set(setData)
          .where(eq(watchlistItem.symbol, r.symbol)),
      );
    }
    if (updates.length > 0) {
      await Promise.allSettled(updates);
    }

    // Also forward to Python Redis cache
    await stockServicePost("/api/ai/watchlist-signals", body).catch(() => {});

    return NextResponse.json({ ok: true, count: results.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save signals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

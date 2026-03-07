import { db } from "@packages/drizzle";
import { watchlistItem } from "@packages/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { getInjection } from "@/common/di/container";
import { stockServicePost } from "@/lib/stock-service";

interface AIResult {
  symbol: string;
  suggested_buy_price?: number | null;
  [key: string]: unknown;
}

export async function POST() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const useCase = getInjection("GetWatchlistUseCase");
    const result = await useCase.execute({
      userId: guard.session.user.id,
    });

    if (result.isFailure) {
      return NextResponse.json({ error: result.getError() }, { status: 500 });
    }

    const output = result.getValue();
    const symbols = output.items.map((item) => item.symbol);

    if (symbols.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const review = (await stockServicePost("/api/ai/watchlist-review", {
      symbols,
    })) as { results: AIResult[] };

    const results: AIResult[] = review.results || [];
    const now = new Date();
    const updates: Promise<unknown>[] = [];
    for (const r of results) {
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
          .where(
            and(
              eq(watchlistItem.userId, guard.session.user.id),
              eq(watchlistItem.symbol, r.symbol),
            ),
          ),
      );
    }
    if (updates.length > 0) {
      await Promise.allSettled(updates);
    }

    return NextResponse.json(review);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to review watchlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

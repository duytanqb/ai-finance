import { db } from "@packages/drizzle";
import { watchlistItem } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { stockServicePost } from "@/lib/stock-service";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;
    const data = await stockServicePost(
      `/api/ai/analyze/${encodeURIComponent(symbol)}`,
    );

    // Auto-add to watchlist for MA50 tracking
    const guard = await authGuard();
    if (guard.authenticated) {
      const id = crypto.randomUUID();
      await db
        .insert(watchlistItem)
        .values({
          id,
          userId: guard.session.user.id,
          symbol: symbol.toUpperCase(),
        })
        .onConflictDoNothing();
    }

    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stock service unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

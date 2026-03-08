import { db } from "@packages/drizzle";
import { watchlistItem } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";

const STOCK_SERVICE_URL =
  process.env.STOCK_SERVICE_URL ||
  process.env.NEXT_PUBLIC_STOCK_SERVICE_URL ||
  "http://localhost:8000";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;

    // Auto-add to watchlist for MA50 tracking
    const guard = await authGuard();
    if (guard.authenticated) {
      const id = crypto.randomUUID();
      db.insert(watchlistItem)
        .values({
          id,
          userId: guard.session.user.id,
          symbol: symbol.toUpperCase(),
        })
        .onConflictDoNothing()
        .then(() => {})
        .catch(() => {});
    }

    const response = await fetch(
      `${STOCK_SERVICE_URL}/api/ai/deep-research/${encodeURIComponent(symbol)}`,
      { method: "POST" },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { error: text || "Deep research failed" },
        { status: response.status },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stock service unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

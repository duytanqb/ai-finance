import { db } from "@packages/drizzle";
import { watchlistItem } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await db
      .select({ symbol: watchlistItem.symbol })
      .from(watchlistItem);

    const uniqueSymbols = [...new Set(rows.map((r) => r.symbol))];
    return NextResponse.json({ symbols: uniqueSymbols });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch symbols";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

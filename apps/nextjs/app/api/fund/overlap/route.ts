import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols");

  if (!symbols) {
    return NextResponse.json(
      { error: "symbols query parameter required" },
      { status: 400 },
    );
  }

  try {
    const data = await stockServiceGet(
      `/api/fund/overlap?symbols=${encodeURIComponent(symbols)}`,
    );
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to compute fund overlap";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

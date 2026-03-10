import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  try {
    const data = await stockServiceGet(
      `/api/fund/${symbol.toUpperCase()}/holdings`,
    );
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch fund holdings";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

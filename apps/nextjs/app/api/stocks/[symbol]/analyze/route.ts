import { NextResponse } from "next/server";
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
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stock service unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

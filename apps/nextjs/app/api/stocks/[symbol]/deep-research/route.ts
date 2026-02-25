import { NextResponse } from "next/server";
import { stockServicePost } from "@/lib/stock-service";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;
    const data = await stockServicePost(
      `/api/ai/deep-research/${encodeURIComponent(symbol)}`,
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

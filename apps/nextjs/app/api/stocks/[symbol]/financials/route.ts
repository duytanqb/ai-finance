import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;
    const data = await stockServiceGet(
      `/api/financial/${encodeURIComponent(symbol)}/ratios`,
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

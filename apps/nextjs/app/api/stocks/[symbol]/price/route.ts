import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);

    const qs = query.toString();
    const data = await stockServiceGet(
      `/api/price/${encodeURIComponent(symbol)}/history${qs ? `?${qs}` : ""}`,
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

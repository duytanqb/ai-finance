import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "dnse";
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const interval = searchParams.get("interval") || "1D";
    const fromTs = searchParams.get("from_ts");
    const toTs = searchParams.get("to_ts");

    const query = new URLSearchParams();
    query.set("source", source);
    query.set("interval", interval);
    if (start) query.set("start", start);
    if (end) query.set("end", end);
    if (fromTs) query.set("from_ts", fromTs);
    if (toTs) query.set("to_ts", toTs);

    const data = await stockServiceGet(
      `/api/price/${encodeURIComponent(symbol)}/history?${query.toString()}`,
    );
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stock service unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

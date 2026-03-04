import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface TopStocksResponse {
  data: Array<{
    symbol: string;
    organ_name: string;
    match_price: number;
    ref_price: number;
    change: number;
    pct_change: number;
    accumulated_volume: number;
    accumulated_value: number;
  }>;
}

export async function GET() {
  try {
    const result = (await stockServiceGet(
      "/api/price/top-stocks?count=10",
    )) as TopStocksResponse;
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ data: [] });
  }
}

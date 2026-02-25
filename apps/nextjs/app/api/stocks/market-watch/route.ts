import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET() {
  try {
    const data = await stockServiceGet("/api/market-watch/digest");
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

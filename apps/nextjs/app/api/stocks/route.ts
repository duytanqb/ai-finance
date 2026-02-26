import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET() {
  try {
    const data = await stockServiceGet("/api/listing/symbols");
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stock service unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

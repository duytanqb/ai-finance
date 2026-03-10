import { NextResponse } from "next/server";
import { stockServicePost } from "@/lib/stock-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await stockServicePost("/api/fund/smart-money", {
      top_n: body.top_n || 10,
      min_return_12m: body.min_return_12m || 5.0,
    });
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Smart money analysis failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

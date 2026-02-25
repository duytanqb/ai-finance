import { NextResponse } from "next/server";
import { stockServicePost } from "@/lib/stock-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await stockServicePost("/api/ai/compare", body);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

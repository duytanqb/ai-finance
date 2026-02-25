import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const data = await stockServiceGet(
      `/api/listing/search?q=${encodeURIComponent(q)}`,
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

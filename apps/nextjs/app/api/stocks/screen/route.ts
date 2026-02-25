import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.toString();
    const data = await stockServiceGet(
      `/api/screening/screen${query ? `?${query}` : ""}`,
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Stock service unavailable" },
      { status: 503 },
    );
  }
}

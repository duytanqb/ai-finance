import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fundType = searchParams.get("type") || "equity";

  try {
    const data = await stockServiceGet(
      `/api/fund/listing?fund_type=${fundType}`,
    );
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch funds";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

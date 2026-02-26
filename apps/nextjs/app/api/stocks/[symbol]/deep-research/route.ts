import { NextResponse } from "next/server";

const STOCK_SERVICE_URL =
  process.env.STOCK_SERVICE_URL ||
  process.env.NEXT_PUBLIC_STOCK_SERVICE_URL ||
  "http://localhost:8000";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { symbol } = await params;
    const response = await fetch(
      `${STOCK_SERVICE_URL}/api/ai/deep-research/${encodeURIComponent(symbol)}`,
      { method: "POST" },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { error: text || "Deep research failed" },
        { status: response.status },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Stock service unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

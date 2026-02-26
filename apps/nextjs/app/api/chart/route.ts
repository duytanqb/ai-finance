import { type NextRequest, NextResponse } from "next/server";

const CHART_IMG_API_KEY = process.env.CHART_IMG_API_KEY || "";
const CHART_IMG_URL = "https://api.chart-img.com/v2/tradingview/advanced-chart";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch(CHART_IMG_URL, {
    method: "POST",
    headers: {
      "x-api-key": CHART_IMG_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch chart", detail: errorText },
      { status: response.status },
    );
  }

  const imageBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

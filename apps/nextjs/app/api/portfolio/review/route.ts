import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { stockServicePost } from "@/lib/stock-service";

export async function POST(request: Request) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const holdings = body.holdings;

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json(
        { error: "No holdings to review" },
        { status: 400 },
      );
    }

    const result = await stockServicePost("/api/ai/portfolio-review", holdings);

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get AI review";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

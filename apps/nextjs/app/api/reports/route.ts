import { and, db, desc, eq } from "@packages/drizzle";
import { analysisReport } from "@packages/drizzle/schema";
import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const symbol = searchParams.get("symbol");
    const reportType = searchParams.get("type");

    const days = searchParams.get("days");
    const conditions = [];

    if (symbol) {
      conditions.push(eq(analysisReport.symbol, symbol.toUpperCase()));
    }
    if (reportType) {
      conditions.push(eq(analysisReport.reportType, reportType));
    }

    if (!symbol && !reportType) {
      return NextResponse.json(
        { error: "symbol or type query parameter is required" },
        { status: 400 },
      );
    }

    const query = db
      .select()
      .from(analysisReport)
      .where(and(...conditions))
      .orderBy(desc(analysisReport.createdAt))
      .limit(days ? 100 : 10);

    const reports = await query;

    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      const filtered = reports.filter((r) => r.createdAt >= cutoff);
      return NextResponse.json({ reports: filtered });
    }

    return NextResponse.json(reports);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, reportType, result, model } = body;

    if (!symbol || !reportType || !result) {
      return NextResponse.json(
        { error: "symbol, reportType, and result are required" },
        { status: 400 },
      );
    }

    let userId = "anonymous";
    const guardResult = await authGuard();
    if (guardResult.authenticated) {
      userId = guardResult.session.user.id;
    }

    const [inserted] = await db
      .insert(analysisReport)
      .values({
        userId,
        symbol: symbol.toUpperCase(),
        reportType,
        result,
        model: model || null,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

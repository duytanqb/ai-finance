import { db } from "@packages/drizzle/config";
import { stockSuggestion } from "@packages/drizzle/schema/stock";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stockServiceGet, stockServicePost } from "@/lib/stock-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkStatus = searchParams.get("status");

  if (checkStatus === "1") {
    try {
      const status = (await stockServiceGet(
        "/api/stock-suggestions/status",
      )) as Record<string, unknown>;
      return NextResponse.json(status);
    } catch (e) {
      return NextResponse.json({
        pipeline_status: "error",
        error: e instanceof Error ? e.message : "Failed to check status",
      });
    }
  }

  try {
    const rows = await db
      .select()
      .from(stockSuggestion)
      .orderBy(desc(stockSuggestion.batchDate), desc(stockSuggestion.score))
      .limit(20);

    if (rows.length === 0) {
      return NextResponse.json({ suggestions: [], batch_date: null });
    }

    const batchDate = rows[0]?.batchDate;
    const latest = rows.filter((r) => r.batchDate === batchDate);

    return NextResponse.json({
      batch_date: batchDate,
      generated_at: latest[0]?.createdAt?.toISOString(),
      suggestions: latest.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        exchange: r.exchange,
        score: r.score,
        sources: r.sources,
        recommendation: r.recommendation,
        confidence: r.confidence,
        target_price: r.targetPrice,
        entry_price: r.entryPrice,
        stop_loss: r.stopLoss,
        deep_research_summary: r.deepResearchSummary,
        deep_research_report_id: r.deepResearchReportId,
        status: r.status,
        batch_date: r.batchDate,
      })),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load suggestions";
    return NextResponse.json(
      { error: message, suggestions: [] },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.suggestions && Array.isArray(body.suggestions)) {
      const toInsert = body.suggestions
        .filter((s: Record<string, unknown>) => s.symbol && s.batch_date)
        .map((s: Record<string, unknown>) => ({
          symbol: String(s.symbol).toUpperCase(),
          name: String(s.name || s.symbol),
          exchange: String(s.exchange || "HOSE"),
          score: Number(s.score) || 0,
          sources: s.sources || [],
          recommendation: String(s.recommendation || "HOLD"),
          confidence: Number(s.confidence) || 0,
          targetPrice: s.target_price != null ? Number(s.target_price) : null,
          entryPrice: s.entry_price != null ? Number(s.entry_price) : null,
          stopLoss: s.stop_loss != null ? Number(s.stop_loss) : null,
          deepResearchSummary: s.deep_research_summary
            ? String(s.deep_research_summary)
            : null,
          deepResearchReportId: s.deep_research_report_id
            ? String(s.deep_research_report_id)
            : null,
          status: String(s.status || "pending"),
          batchDate: String(s.batch_date),
        }));

      if (toInsert.length > 0) {
        await db.insert(stockSuggestion).values(toInsert);
      }

      return NextResponse.json({
        saved: true,
        count: toInsert.length,
      });
    }

    const result = (await stockServicePost(
      "/api/stock-suggestions/run",
    )) as Record<string, unknown>;
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to process request";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

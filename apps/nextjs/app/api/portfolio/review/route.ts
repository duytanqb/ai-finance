import { and, db, desc, eq, inArray } from "@packages/drizzle";
import { analysisReport } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { stockServicePost } from "@/lib/stock-service";

const STOCK_SERVICE_URL =
  process.env.STOCK_SERVICE_URL ||
  process.env.NEXT_PUBLIC_STOCK_SERVICE_URL ||
  "http://localhost:8000";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const holdings = body.holdings as Record<string, unknown>[];

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json(
        { error: "No holdings to review" },
        { status: 400 },
      );
    }

    const symbols = [
      ...new Set(
        holdings
          .map((h) => String(h.symbol || "").toUpperCase())
          .filter(Boolean),
      ),
    ];

    const reports =
      symbols.length > 0
        ? await db
            .select()
            .from(analysisReport)
            .where(
              and(
                inArray(analysisReport.symbol, symbols),
                eq(analysisReport.reportType, "deep_research"),
              ),
            )
            .orderBy(desc(analysisReport.createdAt))
        : [];

    const reportMap = new Map<string, (typeof reports)[0]>();
    for (const r of reports) {
      if (!reportMap.has(r.symbol)) reportMap.set(r.symbol, r);
    }

    const backgroundResearchSymbols: string[] = [];

    const enrichedHoldings = holdings.map((h) => {
      const sym = String(h.symbol || "").toUpperCase();
      const report = reportMap.get(sym);
      const isFresh =
        report &&
        Date.now() - new Date(report.createdAt).getTime() < SEVEN_DAYS_MS;

      if (!isFresh && sym) {
        backgroundResearchSymbols.push(sym);
      }

      if (isFresh && report?.result) {
        const result = report.result as Record<string, unknown>;
        const sections = result.sections as
          | Array<{ title: string; content: string }>
          | undefined;
        const researchSummary = sections
          ?.map((s) => `[${s.title}]\n${s.content}`)
          .join("\n\n");
        return { ...h, research_summary: researchSummary || undefined };
      }
      return h;
    });

    for (const sym of backgroundResearchSymbols) {
      fetch(
        `${STOCK_SERVICE_URL}/api/ai/deep-research-bg/${encodeURIComponent(sym)}`,
        {
          method: "POST",
        },
      ).catch(() => {});
    }

    const result = await stockServicePost(
      "/api/ai/portfolio-review",
      enrichedHoldings,
    );

    return NextResponse.json({
      ...(result as Record<string, unknown>),
      backgroundResearchSymbols,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get AI review";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

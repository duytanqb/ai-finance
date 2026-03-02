"use client";

import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PriceChart } from "./_components/price-chart";

interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface FinancialData {
  pe?: number;
  roe?: number;
  eps?: number;
  marketCap?: number;
  pb?: number;
  debtToEquity?: number;
}

interface ResearchSection {
  section: string;
  title: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

const MOCK_STOCK: StockInfo = {
  symbol: "VCB",
  name: "Vietcombank",
  price: 88500,
  change: 1500,
  changePercent: 1.72,
};

const MOCK_FINANCIALS: FinancialData = {
  pe: 14.2,
  roe: 22.5,
  eps: 6230,
  marketCap: 423000000,
  pb: 3.1,
  debtToEquity: 0.85,
};

function formatVND(value: number | undefined): string {
  if (value === undefined || value === null) return "-";
  return value.toLocaleString("vi-VN");
}

function formatAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function saveReport(
  symbol: string,
  reportType: string,
  result: unknown,
  model?: string,
) {
  try {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, reportType, result, model }),
    });
  } catch {
    // best-effort save
  }
}

const INITIAL_SECTIONS: ResearchSection[] = [
  {
    section: "basic_analysis",
    title: "Phân tích cơ bản",
    content: "",
    status: "pending",
  },
  {
    section: "candle_chart",
    title: "Phân tích biểu đồ nến",
    content: "",
    status: "pending",
  },
  {
    section: "company_analysis",
    title: "Phân tích công ty",
    content: "",
    status: "pending",
  },
  {
    section: "summary",
    title: "Tóm tắt & Khuyến nghị",
    content: "",
    status: "pending",
  },
];

export default function StockDetailPage() {
  const params = useParams();
  const symbol = (params.symbol as string)?.toUpperCase() || "";

  const [stock, setStock] = useState<StockInfo | null>(null);
  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [analysisAge, setAnalysisAge] = useState<string | null>(null);
  const [researchResult, setResearchResult] = useState<string | null>(null);
  const [researchAge, setResearchAge] = useState<string | null>(null);
  const [researchSections, setResearchSections] = useState<ResearchSection[]>(
    [],
  );
  const [researchStep, setResearchStep] = useState(0);
  const [researchTotal] = useState(4);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistMsg, setWatchlistMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    async function fetchData() {
      setLoading(true);
      try {
        const [stockRes, finRes, analyzeRes, researchRes] =
          await Promise.allSettled([
            fetch(`/api/stocks/${symbol}`),
            fetch(`/api/stocks/${symbol}/financials`),
            fetch(`/api/reports?symbol=${symbol}&type=analyze`),
            fetch(`/api/reports?symbol=${symbol}&type=deep_research`),
          ]);

        if (analyzeRes.status === "fulfilled" && analyzeRes.value.ok) {
          const reports = await analyzeRes.value.json();
          if (Array.isArray(reports) && reports.length > 0) {
            setAnalysisResult(reports[0].result as Record<string, unknown>);
            setAnalysisAge(reports[0].createdAt);
          }
        }

        if (researchRes.status === "fulfilled" && researchRes.value.ok) {
          const reports = await researchRes.value.json();
          if (Array.isArray(reports) && reports.length > 0) {
            const r = reports[0].result;
            if (
              r &&
              typeof r === "object" &&
              "sections" in (r as Record<string, unknown>)
            ) {
              const cached = r as Record<string, unknown>;
              setResearchSections(cached.sections as ResearchSection[]);
              setResearchStep(4);
            } else {
              setResearchResult(
                typeof r === "string"
                  ? r
                  : ((r as Record<string, unknown>)?.report as string) ||
                      JSON.stringify(r, null, 2),
              );
            }
            setResearchAge(reports[0].createdAt);
          }
        }

        if (stockRes.status === "fulfilled" && stockRes.value.ok) {
          const raw = await stockRes.value.json();
          const boardList = raw?.data ?? raw;
          const board = Array.isArray(boardList) ? boardList[0] : boardList;
          if (board && !board.error && board.match_price) {
            setStock({
              symbol,
              name: board.organ_name || symbol,
              price: board.match_price,
              change: board.change || 0,
              changePercent: board.pct_change || 0,
            });
          } else {
            setStock({ ...MOCK_STOCK, symbol });
          }
        } else {
          setStock({ ...MOCK_STOCK, symbol });
        }

        if (finRes.status === "fulfilled" && finRes.value.ok) {
          const raw = await finRes.value.json();
          const ratioList = raw?.data ?? raw;
          const ratios = Array.isArray(ratioList) ? ratioList[0] : ratioList;
          if (ratios && !ratios.error && ratios.priceToEarning != null) {
            const leverage = ratios.financialLeverage;
            setFinancials({
              pe: ratios.priceToEarning,
              roe: ratios.roe != null ? ratios.roe * 100 : undefined,
              eps: ratios.earningPerShare,
              marketCap: ratios.market_cap,
              pb: ratios.priceToBook,
              debtToEquity: leverage != null ? leverage - 1 : undefined,
            });
          } else {
            setFinancials(MOCK_FINANCIALS);
          }
        } else {
          setFinancials(MOCK_FINANCIALS);
        }
      } catch {
        setStock({ ...MOCK_STOCK, symbol });
        setFinancials(MOCK_FINANCIALS);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [symbol]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisAge(null);
    try {
      const res = await fetch(`/api/stocks/${symbol}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        const result = data.analysis || data;
        setAnalysisResult(result);
        setAnalysisAge(new Date().toISOString());
        if (!("error" in result)) {
          saveReport(symbol, "analyze", result, "sonnet");
        }
      } else {
        setAnalysisResult({
          error:
            "Analysis unavailable. Make sure stock service is running with ANTHROPIC_API_KEY set.",
        });
      }
    } catch {
      setAnalysisResult({ error: "Failed to connect to analysis service." });
    } finally {
      setAnalyzing(false);
    }
  }, [symbol]);

  const handleDeepResearch = useCallback(async () => {
    setResearching(true);
    setResearchResult(null);
    setResearchAge(null);
    setCollapsedSections(new Set());
    setResearchSections(INITIAL_SECTIONS.map((s) => ({ ...s })));
    setResearchStep(0);

    try {
      const res = await fetch(`/api/stocks/${symbol}/deep-research`, {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        setResearchResult("Deep research unavailable.");
        setResearching(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setResearching(false);
              setResearchAge(new Date().toISOString());
              setResearchSections((prev) => {
                const full = prev
                  .map((s) => `## ${s.title}\n\n${s.content}`)
                  .join("\n\n---\n\n");
                saveReport(
                  symbol,
                  "deep_research",
                  { report: full, sections: prev },
                  "sonnet",
                );
                return prev;
              });
              break;
            }
            if (data.error) {
              setResearchResult(`Error: ${data.error}`);
              setResearching(false);
              break;
            }
            if (data.section) {
              setResearchStep(data.step);
              setResearchSections((prev) =>
                prev.map((s) =>
                  s.section === data.section
                    ? {
                        ...s,
                        status: data.status,
                        content: data.content || s.content,
                      }
                    : s,
                ),
              );
            }
          } catch {
            // skip parse errors
          }
        }
      }
    } catch {
      setResearchResult("Failed to connect to research service.");
      setResearching(false);
    }
  }, [symbol]);

  const handleAddToWatchlist = useCallback(async () => {
    setAddingToWatchlist(true);
    setWatchlistMsg(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) {
        setWatchlistMsg("Added to watchlist");
      } else {
        const data = await res.json();
        setWatchlistMsg(data.error || "Failed to add");
      }
    } catch {
      setWatchlistMsg("Failed to connect");
    } finally {
      setAddingToWatchlist(false);
    }
  }, [symbol]);

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const isPositive = (stock?.change || 0) >= 0;
  const completedSteps = researchSections.filter(
    (s) => s.status === "completed",
  ).length;
  const hasResearchSections = researchSections.some((s) => s.content);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href="/stocks"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Stocks
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {symbol}
          </h1>
          <span className="text-sm text-zinc-500">{stock?.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {formatVND(stock?.price)}
            </span>
            <div
              className={`flex items-center gap-0.5 ${isPositive ? "text-emerald-600" : "text-red-500"}`}
            >
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {isPositive ? "+" : ""}
                {stock?.changePercent?.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2">
        <PriceChart symbol={symbol} />
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="P/E" value={financials?.pe?.toFixed(1) || "-"} />
        <MetricCard
          label="ROE"
          value={financials?.roe ? `${financials.roe.toFixed(1)}%` : "-"}
        />
        <MetricCard label="EPS" value={formatVND(financials?.eps)} />
        <MetricCard label="P/B" value={financials?.pb?.toFixed(2) || "-"} />
        <MetricCard
          label="D/E"
          value={financials?.debtToEquity?.toFixed(2) || "-"}
        />
        <MetricCard
          label="Market Cap"
          value={
            financials?.marketCap
              ? financials.marketCap >= 1e12
                ? `${(financials.marketCap / 1e12).toFixed(1)}T`
                : `${(financials.marketCap / 1e9).toFixed(0)}B`
              : "-"
          }
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {analyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : analysisAge ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {analyzing
            ? "Analyzing..."
            : analysisAge
              ? "Re-analyze"
              : "Analyze with AI"}
        </button>
        <button
          type="button"
          onClick={handleDeepResearch}
          disabled={researching}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {researching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : researchAge ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <BookOpen className="h-3.5 w-3.5" />
          )}
          {researching
            ? "Researching..."
            : researchAge
              ? "Re-research"
              : "Deep Research"}
        </button>
        <button
          type="button"
          onClick={handleAddToWatchlist}
          disabled={addingToWatchlist || watchlistMsg === "Added to watchlist"}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {addingToWatchlist ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {watchlistMsg ||
            (addingToWatchlist ? "Adding..." : "Add to Watchlist")}
        </button>
        <Link
          href={`/trading?symbol=${symbol}&side=BUY`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Trade
        </Link>
        {analysisAge && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
            <Clock className="h-3 w-3" />
            Analyzed {formatAge(analysisAge)}
          </span>
        )}
      </div>

      {/* AI Analysis Result */}
      {analysisResult && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-zinc-400" />
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              AI Analysis
            </h2>
            {"action" in analysisResult && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  analysisResult.action === "BUY"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : analysisResult.action === "AVOID"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {analysisResult.action as string}
              </span>
            )}
            {"confidence" in analysisResult && (
              <span className="text-xs text-zinc-400">
                Confidence: {analysisResult.confidence as number}%
              </span>
            )}
          </div>
          {"error" in analysisResult ? (
            <p className="text-sm text-red-500">
              {analysisResult.error as string}
            </p>
          ) : (
            <div className="space-y-3">
              {"summary" in analysisResult && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {analysisResult.summary as string}
                </p>
              )}
              {"reasoning" in analysisResult && (
                <p className="text-sm text-zinc-500">
                  {analysisResult.reasoning as string}
                </p>
              )}
              {("entry_price" in analysisResult ||
                "target_price" in analysisResult) && (
                <div className="flex gap-6 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  {"entry_price" in analysisResult && (
                    <div>
                      <span className="text-xs text-zinc-500">Entry</span>
                      <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {formatVND(analysisResult.entry_price as number)}
                      </p>
                    </div>
                  )}
                  {"target_price" in analysisResult && (
                    <div>
                      <span className="text-xs text-zinc-500">Target</span>
                      <p className="text-sm font-mono font-medium text-emerald-600">
                        {formatVND(analysisResult.target_price as number)}
                      </p>
                    </div>
                  )}
                  {"stop_loss" in analysisResult && (
                    <div>
                      <span className="text-xs text-zinc-500">Stop Loss</span>
                      <p className="text-sm font-mono font-medium text-red-500">
                        {formatVND(analysisResult.stop_loss as number)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deep Research — Progress Stepper + Section Cards */}
      {(researching || hasResearchSections) && (
        <div className="space-y-4">
          {/* Progress Stepper */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4 text-zinc-400" />
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                Deep Research Report
              </h2>
              {researchAge && (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                  <Clock className="h-3 w-3" />
                  {formatAge(researchAge)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-3">
              {researchSections.map((s, i) => (
                <div key={s.section} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={`h-px w-6 ${
                        s.status === "completed" || s.status === "in_progress"
                          ? "bg-zinc-400 dark:bg-zinc-500"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    {s.status === "completed" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : s.status === "in_progress" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
                    )}
                    <span
                      className={`text-xs ${
                        s.status === "completed"
                          ? "text-zinc-700 dark:text-zinc-300"
                          : s.status === "in_progress"
                            ? "text-blue-600 dark:text-blue-400 font-medium"
                            : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      {s.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
              <div
                className="bg-zinc-900 dark:bg-zinc-100 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(completedSteps / researchTotal) * 100}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1.5">
              {researching
                ? `Step ${researchStep} of ${researchTotal}...`
                : `${completedSteps}/${researchTotal} sections complete`}
            </p>
          </div>

          {/* Section Cards */}
          {researchSections
            .filter((s) => s.content)
            .map((s) => {
              const isCollapsed = collapsedSections.has(s.section);
              return (
                <div
                  key={s.section}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(s.section)}
                    className="w-full flex items-center gap-2 p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                    )}
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                      {s.title}
                    </span>
                    <Check className="h-3.5 w-3.5 text-emerald-500 ml-auto shrink-0" />
                  </button>
                  {!isCollapsed && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                        {s.content}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Fallback plain-text deep research (for old cached reports) */}
      {researchResult && !hasResearchSections && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-zinc-400" />
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Deep Research Report
            </h2>
            {researchAge && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                <Clock className="h-3 w-3" />
                {formatAge(researchAge)}
              </span>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
            {researchResult}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-center">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
        {value}
      </p>
    </div>
  );
}

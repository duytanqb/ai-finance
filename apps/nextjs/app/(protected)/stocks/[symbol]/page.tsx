"use client";

import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Eye,
  Loader2,
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

interface PricePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface FinancialData {
  pe?: number;
  roe?: number;
  eps?: number;
  marketCap?: number;
  pb?: number;
  debtToEquity?: number;
}

const MOCK_STOCK: StockInfo = {
  symbol: "VCB",
  name: "Vietcombank",
  price: 88500,
  change: 1500,
  changePercent: 1.72,
};

const MOCK_PRICES: PricePoint[] = Array.from({ length: 120 }, (_, i) => {
  const base = 80000 + Math.sin(i / 10) * 5000 + i * 50;
  return {
    time: new Date(2025, 8, 1 + i).toISOString().slice(0, 10),
    open: base - 200,
    high: base + 500,
    low: base - 500,
    close: base + 300,
  };
});

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

export default function StockDetailPage() {
  const params = useParams();
  const symbol = (params.symbol as string)?.toUpperCase() || "";

  const [stock, setStock] = useState<StockInfo | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [researchResult, setResearchResult] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    async function fetchData() {
      setLoading(true);
      try {
        const [stockRes, priceRes, finRes] = await Promise.allSettled([
          fetch(`/api/stocks/${symbol}`),
          fetch(`/api/stocks/${symbol}/price?start=2025-06-01&end=2026-02-25`),
          fetch(`/api/stocks/${symbol}/financials`),
        ]);

        if (stockRes.status === "fulfilled" && stockRes.value.ok) {
          const data = await stockRes.value.json();
          if (data && !data.error) {
            const board = Array.isArray(data) ? data[0] : data;
            setStock({
              symbol,
              name: board.organ_name || board.stockName || symbol,
              price: board.close || board.matchedPrice || MOCK_STOCK.price,
              change: board.change || 0,
              changePercent: board.pctChange || board.changePercent || 0,
            });
          } else {
            setStock({ ...MOCK_STOCK, symbol });
          }
        } else {
          setStock({ ...MOCK_STOCK, symbol });
        }

        if (priceRes.status === "fulfilled" && priceRes.value.ok) {
          const data = await priceRes.value.json();
          if (Array.isArray(data) && data.length > 0) {
            setPrices(data);
          } else {
            setPrices(MOCK_PRICES);
          }
        } else {
          setPrices(MOCK_PRICES);
        }

        if (finRes.status === "fulfilled" && finRes.value.ok) {
          const data = await finRes.value.json();
          const ratios = Array.isArray(data) ? data[0] : data;
          if (ratios && !ratios.error) {
            setFinancials({
              pe: ratios.priceToEarning || ratios.pe,
              roe: ratios.roe,
              eps: ratios.earningPerShare || ratios.eps,
              marketCap: ratios.marketCap,
              pb: ratios.priceToBook || ratios.pb,
              debtToEquity: ratios.debtOnEquity || ratios.debtToEquity,
            });
          } else {
            setFinancials(MOCK_FINANCIALS);
          }
        } else {
          setFinancials(MOCK_FINANCIALS);
        }
      } catch {
        setStock({ ...MOCK_STOCK, symbol });
        setPrices(MOCK_PRICES);
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
    try {
      const res = await fetch(`/api/stocks/${symbol}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data.analysis || data);
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
    try {
      const res = await fetch(`/api/stocks/${symbol}/deep-research`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setResearchResult(data.report || JSON.stringify(data, null, 2));
      } else {
        setResearchResult(
          "Deep research unavailable. Requires ANTHROPIC_API_KEY.",
        );
      }
    } catch {
      setResearchResult("Failed to connect to research service.");
    } finally {
      setResearching(false);
    }
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const isPositive = (stock?.change || 0) >= 0;

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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-3">
          Price History
        </h2>
        <PriceChart data={prices} />
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
              ? `${(financials.marketCap / 1e9).toFixed(0)}B`
              : "-"
          }
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {analyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {analyzing ? "Analyzing..." : "Analyze with AI"}
        </button>
        <button
          type="button"
          onClick={handleDeepResearch}
          disabled={researching}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {researching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BookOpen className="h-3.5 w-3.5" />
          )}
          {researching ? "Researching..." : "Deep Research"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Add to Watchlist
        </button>
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

      {/* Deep Research Result */}
      {researchResult && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-zinc-400" />
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Deep Research Report
            </h2>
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

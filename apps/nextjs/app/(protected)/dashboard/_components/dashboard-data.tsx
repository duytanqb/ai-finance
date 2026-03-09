"use client";

import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import {
  BarChart3,
  Briefcase,
  ExternalLink,
  Eye,
  Loader2,
  Newspaper,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketRefresh } from "@/lib/use-market-refresh";

interface DashboardData {
  portfolio: { count: number };
  watchlist: { count: number };
  recentReports: Array<{
    id: string;
    symbol: string;
    reportType: string;
    result: Record<string, unknown>;
    model: string | null;
    createdAt: string;
  }>;
}

interface IndexData {
  value: number;
  change: number;
  changePercent: number;
  chart: Array<{ time: number; value: number }>;
}

interface MarketData {
  vnindex: IndexData | null;
}

interface TopStock {
  symbol: string;
  organ_name: string;
  match_price: number;
  ref_price: number;
  change: number;
  pct_change: number;
  accumulated_volume: number;
  accumulated_value: number;
}

interface NewsItem {
  title: string;
  summary: string;
  impact: string;
  related_sectors: string[];
  url: string;
  source: string;
  published_at: string;
}

interface MarketNewsData {
  market_mood: string | null;
  market_summary: string | null;
  generated_at: string | null;
  important_news: NewsItem[];
}

const MOOD_CONFIG: Record<string, { label: string; color: string }> = {
  positive: {
    label: "Tích cực",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  negative: {
    label: "Tiêu cực",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  neutral: {
    label: "Trung tính",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

const IMPACT_DOT: Record<string, string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  neutral: "bg-amber-400",
};

function formatAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return String(vol);
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}B`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}M`;
  return val.toFixed(0);
}

export function DashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [topStocks, setTopStocks] = useState<TopStock[]>([]);
  const [marketNews, setMarketNews] = useState<MarketNewsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, marketRes, topRes, newsRes] = await Promise.allSettled([
        fetch("/api/dashboard"),
        fetch("/api/dashboard/market"),
        fetch("/api/dashboard/top-stocks"),
        fetch("/api/dashboard/news"),
      ]);
      if (dashRes.status === "fulfilled" && dashRes.value.ok) {
        setData(await dashRes.value.json());
      }
      if (marketRes.status === "fulfilled" && marketRes.value.ok) {
        setMarket(await marketRes.value.json());
      }
      if (topRes.status === "fulfilled" && topRes.value.ok) {
        const result = await topRes.value.json();
        setTopStocks(result.data ?? []);
      }
      if (newsRes.status === "fulfilled" && newsRes.value.ok) {
        setMarketNews(await newsRes.value.json());
      }
    } catch {
      // fallback to empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useMarketRefresh(fetchDashboard);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  const portfolioCount = data?.portfolio.count ?? 0;
  const watchlistCount = data?.watchlist.count ?? 0;
  const reports = data?.recentReports ?? [];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <IndexCard label="VN-Index" data={market?.vnindex ?? null} />
        <StatCard
          label="Portfolio"
          value={String(portfolioCount)}
          subtitle={
            portfolioCount > 0
              ? `${portfolioCount} holding${portfolioCount > 1 ? "s" : ""}`
              : "No holdings yet"
          }
        />
        <StatCard
          label="Watchlist"
          value={String(watchlistCount)}
          subtitle={
            watchlistCount > 0
              ? `${watchlistCount} item${watchlistCount > 1 ? "s" : ""}`
              : "Empty watchlist"
          }
        />
      </div>

      {topStocks.length > 0 && <TopStocksTable stocks={topStocks} />}

      {marketNews &&
        marketNews.important_news &&
        marketNews.important_news.length > 0 && (
          <MarketNewsSection news={marketNews} />
        )}

      <div className="grid gap-4 md:grid-cols-3">
        <QuickAction
          href="/stocks"
          icon={TrendingUp}
          title="Analyze Stock"
          description="Search and analyze any stock with AI"
        />
        <QuickAction
          href="/portfolio"
          icon={Briefcase}
          title="Portfolio"
          description="Track holdings, P&L, and AI suggestions"
        />
        <QuickAction
          href="/market-watch"
          icon={Eye}
          title="Market Watch"
          description="Daily AI picks and research reports"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Recent AI Reports
          </h2>
        </div>
        {reports.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No reports yet</p>
            <p className="text-xs mt-1">
              Click &quot;Analyze Stock&quot; on any stock page to generate your
              first report
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const result = report.result as Record<string, unknown>;
              const action = result?.action as string | undefined;
              return (
                <Link
                  key={report.id}
                  href={`/stocks/${report.symbol}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-zinc-400" />
                    <div>
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {report.symbol}
                      </span>
                      <span className="text-xs text-zinc-400 ml-2">
                        {report.reportType === "deep_research"
                          ? "Deep Research"
                          : "Analysis"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {action && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          action === "BUY"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : action === "AVOID"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {action}
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {formatAge(report.createdAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
        {value}
      </p>
      <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>
    </div>
  );
}

function IndexMiniChart({
  chart,
  positive,
}: {
  chart: Array<{ time: number; value: number }>;
  positive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chart.length === 0) return;

    const c = createChart(container, {
      width: container.clientWidth,
      height: 60,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = c;

    const color = positive ? "#22c55e" : "#ef4444";
    const series = c.addSeries(AreaSeries, {
      topColor: positive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
      bottomColor: positive ? "rgba(34,197,94,0.0)" : "rgba(239,68,68,0.0)",
      lineColor: color,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const lineData: LineData[] = chart.map((p) => ({
      time: p.time as Time,
      value: p.value,
    }));
    series.setData(lineData);
    c.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chart, positive]);

  if (chart.length === 0) return null;

  return <div ref={containerRef} className="w-full h-[60px] mt-2" />;
}

function IndexCard({ label, data }: { label: string; data: IndexData | null }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-zinc-400 mt-1">-</p>
        <p className="text-xs text-zinc-400 mt-1">Unavailable</p>
      </div>
    );
  }

  const positive = data.change >= 0;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
        {data.value.toLocaleString("vi-VN", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}
      </p>
      <p
        className={`text-xs font-medium mt-1 ${positive ? "text-emerald-600" : "text-red-500"}`}
      >
        {positive ? "+" : ""}
        {data.change.toFixed(1)} ({positive ? "+" : ""}
        {data.changePercent.toFixed(2)}%)
      </p>
      <IndexMiniChart chart={data.chart ?? []} positive={positive} />
    </div>
  );
}

function TopStocksTable({ stocks }: { stocks: TopStock[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        Giao dịch nhiều nhất hôm nay
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left pb-2 font-medium">Mã</th>
              <th className="text-right pb-2 font-medium">Giá</th>
              <th className="text-right pb-2 font-medium">+/-</th>
              <th className="text-right pb-2 font-medium">KL</th>
              <th className="text-right pb-2 font-medium hidden sm:table-cell">
                GT
              </th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => {
              const positive = s.pct_change > 0;
              const negative = s.pct_change < 0;
              return (
                <tr
                  key={s.symbol}
                  className="border-b border-zinc-50 dark:border-zinc-900 last:border-0"
                >
                  <td className="py-2">
                    <Link
                      href={`/stocks/${s.symbol}`}
                      className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {s.symbol}
                    </Link>
                  </td>
                  <td className="py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {s.match_price.toLocaleString("vi-VN")}
                  </td>
                  <td
                    className={`py-2 text-right font-mono font-medium ${
                      positive
                        ? "text-emerald-600"
                        : negative
                          ? "text-red-500"
                          : "text-zinc-400"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {s.pct_change.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right font-mono text-zinc-500">
                    {formatVolume(s.accumulated_volume)}
                  </td>
                  <td className="py-2 text-right font-mono text-zinc-500 hidden sm:table-cell">
                    {formatValue(s.accumulated_value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
    >
      <Icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mt-3">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 mt-1">{description}</p>
    </Link>
  );
}

function MarketNewsSection({ news }: { news: MarketNewsData }) {
  const mood = MOOD_CONFIG[news.market_mood ?? "neutral"] ?? {
    label: "Trung tính",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Tin tức thị trường
          </h2>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${mood.color}`}
          >
            {mood.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {news.generated_at && (
            <span className="text-xs text-zinc-400">
              {formatAge(news.generated_at)}
            </span>
          )}
          <Link
            href="/market-watch"
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>

      {news.market_summary && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
          {news.market_summary}
        </p>
      )}

      <div className="space-y-3">
        {news.important_news.map((item, i) => (
          <div
            key={`${item.source}-${i}`}
            className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50"
          >
            <span
              className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${IMPACT_DOT[item.impact] ?? IMPACT_DOT.neutral}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {item.title}
                      <ExternalLink className="inline h-3 w-3 ml-1 opacity-40" />
                    </a>
                  ) : (
                    item.title
                  )}
                </p>
              </div>
              {item.summary && (
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {item.summary}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {item.source && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                    {item.source}
                  </span>
                )}
                {item.related_sectors?.map((sector) => (
                  <span
                    key={sector}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

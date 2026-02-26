"use client";

import {
  BarChart3,
  Briefcase,
  Eye,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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

function formatAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // fallback to empty state
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="VN-Index" value="Coming soon" subtitle="Market data" />
        <StatCard
          label="HNX-Index"
          value="Coming soon"
          subtitle="Market data"
        />
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

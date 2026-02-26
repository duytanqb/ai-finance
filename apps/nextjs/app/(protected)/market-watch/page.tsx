"use client";

import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface MarketPick {
  symbol: string;
  name: string;
  exchange: string;
  price: number | null;
  pe: number | null;
  roe: number | null;
  score: number | null;
  action: string;
  confidence: number;
  summary: string;
  entry_price: number | null;
  target_price: number | null;
  news_count: number;
  top_news: { title: string; url: string; source?: string }[];
}

interface DigestResponse {
  date: string;
  generated_at: string;
  market_summary: string;
  top_picks: MarketPick[];
  total_scanned: number;
  cached?: boolean;
  error?: string;
}

const ACTION_STYLES: Record<string, string> = {
  BUY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  WATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  AVOID: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatPrice(value: number | null): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("vi-VN").format(value);
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MarketWatchPage() {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks/market-watch");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DigestResponse = await res.json();
      if (data.error && !data.top_picks?.length) {
        setError(data.error);
      } else {
        setDigest(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load market watch");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks/market-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: true }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DigestResponse = await res.json();
      if (data.error && !data.top_picks?.length) {
        setError(data.error);
      } else {
        setDigest(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Market Watch
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Cổ phiếu giá trị & tin tức thị trường — cập nhật mỗi 6 giờ
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw
            className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Đang phân tích..." : "Làm mới"}
        </button>
      </div>

      {/* Loading state — only show full spinner on first load */}
      {loading && !digest && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Đang tải dữ liệu...</p>
        </div>
      )}

      {/* Refresh indicator when we already have data */}
      {refreshing && digest && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-600 dark:text-blue-400">
            Đang chạy AI pipeline... Có thể mất vài phút.
          </span>
        </div>
      )}

      {/* Error state */}
      {error && !digest && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Không thể tải dữ liệu
            </span>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400/80">
            {error}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            className="mt-3 text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {digest && (
        <>
          {/* Daily Summary */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-zinc-400" />
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                Tổng quan thị trường
              </h2>
              <span className="text-xs text-zinc-400 ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(digest.generated_at)}
                <span className="text-zinc-300 dark:text-zinc-600 mx-1">
                  &middot;
                </span>
                {formatDate(digest.generated_at)}
                {digest.cached && (
                  <span className="ml-1 text-amber-500">(cached)</span>
                )}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {digest.market_summary}
            </p>
            {digest.total_scanned > 0 && (
              <p className="text-xs text-zinc-400 mt-2">
                {digest.total_scanned} cổ phiếu được quét
              </p>
            )}
          </div>

          {/* Stock Picks */}
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cổ phiếu đáng chú ý
              {digest.top_picks.length > 0 && (
                <span className="text-xs font-normal text-zinc-400">
                  ({digest.top_picks.length} mã)
                </span>
              )}
            </h2>

            {digest.top_picks.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 text-center">
                <p className="text-sm text-zinc-500">
                  Chưa có dữ liệu. Nhấn &quot;Làm mới&quot; để chạy phân tích.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {digest.top_picks.map((pick) => (
                  <div
                    key={pick.symbol}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {pick.symbol}
                        </span>
                        {pick.name && (
                          <span className="text-xs text-zinc-400">
                            {pick.name}
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${ACTION_STYLES[pick.action] ?? ACTION_STYLES.WATCH}`}
                        >
                          {pick.action}
                        </span>
                        {pick.confidence > 0 && (
                          <span className="text-xs text-zinc-400">
                            Confidence: {pick.confidence}%
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {pick.exchange}
                      </span>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                      {pick.summary}
                    </p>

                    {/* Metrics */}
                    <div className="flex gap-6 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      {pick.price != null && (
                        <div>
                          <span className="text-xs text-zinc-500">Giá</span>
                          <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {formatPrice(pick.price)}
                          </p>
                        </div>
                      )}
                      {pick.entry_price != null && (
                        <div>
                          <span className="text-xs text-zinc-500">Giá vào</span>
                          <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {formatPrice(pick.entry_price)}
                          </p>
                        </div>
                      )}
                      {pick.target_price != null && (
                        <div>
                          <span className="text-xs text-zinc-500">
                            Mục tiêu
                          </span>
                          <p className="text-sm font-mono font-medium text-emerald-600">
                            {formatPrice(pick.target_price)}
                          </p>
                        </div>
                      )}
                      {pick.pe != null && (
                        <div>
                          <span className="text-xs text-zinc-500">P/E</span>
                          <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {pick.pe.toFixed(1)}
                          </p>
                        </div>
                      )}
                      {pick.roe != null && (
                        <div>
                          <span className="text-xs text-zinc-500">ROE</span>
                          <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {pick.roe.toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* News */}
                    {pick.top_news && pick.top_news.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Newspaper className="h-3 w-3 text-zinc-400" />
                          <span className="text-xs font-medium text-zinc-500">
                            Tin tức ({pick.news_count})
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {pick.top_news.map((news, i) => (
                            <a
                              key={`${pick.symbol}-news-${i}`}
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors group"
                            >
                              <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
                              <span className="line-clamp-1">{news.title}</span>
                              {news.source && (
                                <span className="shrink-0 text-zinc-400">
                                  — {news.source}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Analyze Button */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                      <Link
                        href={`/stocks/${pick.symbol}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Phân tích chi tiết
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

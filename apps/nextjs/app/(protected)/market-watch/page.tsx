"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface MarketPick {
  symbol: string;
  name: string;
  exchange: string;
  price: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  eps: number | null;
  quality_score: number | null;
  score: number | null;
  action: string;
  confidence: number;
  summary: string;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  risk_level: string | null;
  source: string;
  sector_name?: string;
  sector_thesis?: string;
  sector_alignment?: string;
  news_count: number;
  top_news: {
    title: string;
    url: string;
    source?: string;
    published_at?: string;
  }[];
  income_summary: {
    revenue_growth_pct: number | null;
    profit_growth_pct: number | null;
  } | null;
  balance_summary: { debt_to_equity: number | null } | null;
}

interface SectorSummary {
  sector_name: string;
  confidence: number;
  thesis: string;
  catalysts: string[];
  stock_count: number;
}

interface PipelineStageInfo {
  stage: number;
  name: string;
  result: string;
  started_at: number | null;
  completed_at: number | null;
  duration: number | null;
}

interface PipelineProgress {
  current_stage: number;
  current_stage_name: string;
  stage_detail: string;
  stages: PipelineStageInfo[];
}

interface DigestResponse {
  date: string;
  generated_at: string;
  market_summary: string;
  market_mood?: string;
  pipeline_type?: string;
  sector_analysis?: SectorSummary[];
  sector_groups?: Record<string, string[]>;
  top_picks: MarketPick[];
  total_scanned: number;
  pipeline_stages?: Record<string, number>;
  pipeline_status?: string;
  cached?: boolean;
  error?: string;
}

interface YouTubeVideoSummary {
  video_id: string;
  title: string;
  channel_name: string;
  published_at: string;
  thumbnail_url: string;
  duration_minutes: number;
  stocks_mentioned: { symbol: string; sentiment: string; context: string }[];
  sectors: { name: string; outlook: string }[];
  key_points: string[];
  risk_warnings: string[];
  trading_recommendations: string[];
  overall_sentiment: "bullish" | "bearish" | "neutral";
  summary: string;
}

interface YouTubeDigestData {
  date: string;
  generated_at: string;
  videos_processed: number;
  video_summaries: YouTubeVideoSummary[];
  digest: {
    consensus_stocks: {
      symbol: string;
      mentions: number;
      avg_sentiment: string;
      contexts: string[];
    }[];
    hot_sectors: {
      name: string;
      outlook: string;
      mentioned_by: string[];
    }[];
    conflicting_views: {
      topic: string;
      views: { creator: string; position: string }[];
    }[];
    risk_warnings: string[];
    market_sentiment: string;
    summary: string;
  };
  cached?: boolean;
}

const SENTIMENT_STYLES: Record<string, { label: string; color: string }> = {
  bullish: {
    label: "Tích cực",
    color:
      "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  neutral: {
    label: "Trung lập",
    color:
      "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
  },
  bearish: {
    label: "Tiêu cực",
    color: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  },
};

const ACTION_STYLES: Record<string, string> = {
  BUY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  WATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  AVOID: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const MOOD_STYLES: Record<string, { label: string; color: string }> = {
  positive: {
    label: "Tích cực",
    color:
      "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  neutral: {
    label: "Trung lập",
    color:
      "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
  },
  negative: {
    label: "Tiêu cực",
    color: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  },
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

const POLL_INTERVAL = 8000;
const MAX_POLL_TIME = 20 * 60 * 1000;

interface SourceItem {
  label: string;
  url?: string;
}

function SourceTags({ sources }: { sources: SourceItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
        Nguồn
      </span>
      {sources.map((s) =>
        s.url ? (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {s.label}
          </a>
        ) : (
          <span
            key={s.label}
            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          >
            {s.label}
          </span>
        ),
      )}
    </div>
  );
}

const NEWS_SOURCES: SourceItem[] = [
  { label: "CafeF", url: "https://cafef.vn/thi-truong-chung-khoan.chn" },
  { label: "VnExpress", url: "https://vnexpress.net/kinh-doanh/chung-khoan" },
  { label: "Vietstock", url: "https://vietstock.vn/chung-khoan.htm" },
  { label: "VnEconomy", url: "https://vneconomy.vn/chung-khoan.htm" },
  {
    label: "SSI Research",
    url: "https://www.ssi.com.vn/khach-hang-ca-nhan/ban-tin-thi-truong",
  },
];

function StockCard({ pick }: { pick: MarketPick }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {pick.symbol}
          </span>
          {pick.name && (
            <span className="text-xs text-zinc-400">{pick.name}</span>
          )}
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${ACTION_STYLES[pick.action] ?? ACTION_STYLES.WATCH}`}
          >
            {pick.action}
          </span>
          {pick.confidence > 0 && (
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {pick.confidence}%
            </span>
          )}
          {pick.risk_level && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                pick.risk_level === "low"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : pick.risk_level === "high"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              <Shield className="h-3 w-3" />
              {pick.risk_level === "low"
                ? "Rủi ro thấp"
                : pick.risk_level === "high"
                  ? "Rủi ro cao"
                  : "Rủi ro TB"}
            </span>
          )}
          {pick.sector_alignment && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {pick.sector_alignment}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pick.quality_score != null && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                pick.quality_score >= 60
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : pick.quality_score >= 40
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              Q:{Math.round(pick.quality_score)}
            </span>
          )}
          <span className="text-xs text-zinc-400">{pick.exchange}</span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
        {pick.summary}
      </p>

      {/* Metrics */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
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
            <span className="text-xs text-zinc-500">Mục tiêu</span>
            <p className="text-sm font-mono font-medium text-emerald-600">
              {formatPrice(pick.target_price)}
            </p>
          </div>
        )}
        {pick.stop_loss != null && (
          <div>
            <span className="text-xs text-zinc-500">Cắt lỗ</span>
            <p className="text-sm font-mono font-medium text-red-500">
              {formatPrice(pick.stop_loss)}
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
        {pick.pb != null && (
          <div>
            <span className="text-xs text-zinc-500">P/B</span>
            <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {pick.pb.toFixed(1)}
            </p>
          </div>
        )}
        {pick.roe != null && (
          <div>
            <span className="text-xs text-zinc-500">ROE</span>
            <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {(pick.roe * 100).toFixed(1)}%
            </p>
          </div>
        )}
        {pick.income_summary?.revenue_growth_pct != null && (
          <div>
            <span className="text-xs text-zinc-500">DT YoY</span>
            <p
              className={`text-sm font-mono font-medium ${pick.income_summary.revenue_growth_pct >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {pick.income_summary.revenue_growth_pct >= 0 ? "+" : ""}
              {(pick.income_summary.revenue_growth_pct * 100).toFixed(0)}%
            </p>
          </div>
        )}
        {pick.balance_summary?.debt_to_equity != null && (
          <div>
            <span className="text-xs text-zinc-500">D/E</span>
            <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {pick.balance_summary.debt_to_equity.toFixed(1)}
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
                <span className="line-clamp-1 flex-1">{news.title}</span>
                <span className="shrink-0 text-zinc-400">
                  {news.published_at && `${news.published_at} `}
                  {news.source && `— ${news.source}`}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      <SourceTags
        sources={
          pick.confidence > 0
            ? [
                { label: "Tài chính: VCI" },
                ...NEWS_SOURCES,
                { label: "AI: Claude Sonnet" },
              ]
            : [{ label: "Tài chính: VCI" }, { label: "AI: Claude Sonnet" }]
        }
      />

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
  );
}

function SectorCard({ sector }: { sector: SectorSummary }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
          {sector.sector_name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{sector.stock_count} mã</span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              sector.confidence >= 70
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : sector.confidence >= 40
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {sector.confidence}%
          </span>
        </div>
      </div>
      {/* Confidence bar */}
      <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-2">
        <div
          className={`h-full rounded-full transition-all ${
            sector.confidence >= 70
              ? "bg-emerald-500"
              : sector.confidence >= 40
                ? "bg-amber-500"
                : "bg-zinc-400"
          }`}
          style={{ width: `${Math.min(sector.confidence, 100)}%` }}
        />
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {sector.thesis}
      </p>
      {sector.catalysts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {sector.catalysts.map((c) => (
            <span
              key={c}
              className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const PIPELINE_STAGES = [
  { stage: 1, name: "Phân tích tin tức" },
  { stage: 2, name: "Lọc cổ phiếu theo ngành" },
  { stage: 3, name: "AI chọn lọc theo tin tức" },
  { stage: 4, name: "Kiểm tra tài chính" },
  { stage: 5, name: "AI phân tích" },
  { stage: 6, name: "Thu thập tin tức" },
];

function PipelineStepper({ progress }: { progress: PipelineProgress }) {
  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Đang chạy AI pipeline...
        </span>
      </div>
      <div className="space-y-2">
        {PIPELINE_STAGES.map(({ stage, name }) => {
          const completed = progress.stages.find(
            (s) => s.stage === stage && s.completed_at != null,
          );
          const isRunning = progress.current_stage === stage && !completed;
          const isPending = !completed && !isRunning;

          return (
            <div
              key={stage}
              className={`flex items-start gap-2.5 text-sm ${
                isPending ? "text-zinc-400 dark:text-zinc-600" : ""
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0">
                {completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${
                      completed
                        ? "text-zinc-700 dark:text-zinc-300"
                        : isRunning
                          ? "text-blue-700 dark:text-blue-300"
                          : ""
                    }`}
                  >
                    {stage}. {name}
                  </span>
                  {completed?.duration != null && (
                    <span className="text-xs text-zinc-400">
                      ({completed.duration}s)
                    </span>
                  )}
                </div>
                {completed?.result && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                    {completed.result}
                  </p>
                )}
                {isRunning && progress.stage_detail && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 truncate">
                    {progress.stage_detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketWatchPage() {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipelineProgress, setPipelineProgress] =
    useState<PipelineProgress | null>(null);
  const [ytDigest, setYtDigest] = useState<YouTubeDigestData | null>(null);
  const [ytExpanded, setYtExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

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

  const pollForResults = useCallback(() => {
    const currentGeneratedAt = digest?.generated_at;

    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > MAX_POLL_TIME) {
        stopPolling();
        setRefreshing(false);
        setRefreshError(
          "Pipeline vượt quá thời gian chờ. Vui lòng thử lại sau.",
        );
        return;
      }

      try {
        const res = await fetch("/api/stocks/market-watch?status=1");
        if (!res.ok) return;
        const data = await res.json();

        if (data.pipeline_status === "running") {
          setPipelineProgress({
            current_stage: data.current_stage ?? 0,
            current_stage_name: data.current_stage_name ?? "",
            stage_detail: data.stage_detail ?? "",
            stages: data.stages ?? [],
          });
        }

        if (data.pipeline_status === "completed" && data.top_picks?.length) {
          stopPolling();
          setPipelineProgress(null);
          setDigest(data as DigestResponse);
          setRefreshing(false);
          setRefreshError(null);
          return;
        }

        if (data.pipeline_status === "error") {
          stopPolling();
          setPipelineProgress(null);
          setRefreshing(false);
          setRefreshError(data.error || "Pipeline gặp lỗi");
          return;
        }

        if (
          data.pipeline_status === "completed" &&
          data.generated_at &&
          data.generated_at !== currentGeneratedAt
        ) {
          stopPolling();
          setPipelineProgress(null);
          await fetchDigest();
          setRefreshing(false);
          setRefreshError(null);
        }
      } catch {
        // Network error during poll — keep trying
      }
    }, POLL_INTERVAL);
  }, [digest?.generated_at, stopPolling, fetchDigest]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    stopPolling();

    try {
      const res = await fetch("/api/stocks/market-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: true }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (data.pipeline_status === "error") {
        setRefreshing(false);
        setRefreshError(data.error || "Không thể khởi chạy pipeline");
        return;
      }

      pollStartRef.current = Date.now();
      pollForResults();
    } catch (e) {
      setRefreshing(false);
      setRefreshError(
        e instanceof Error ? e.message : "Không thể kết nối stock service",
      );
    }
  }, [stopPolling, pollForResults]);

  useEffect(() => {
    fetchDigest();
    fetch("/api/youtube/digest")
      .then((r) => r.json())
      .then((data) => {
        if (data.digest) setYtDigest(data as YouTubeDigestData);
      })
      .catch(() => {});
    return () => stopPolling();
  }, [fetchDigest, stopPolling]);

  const hasSectorData =
    digest?.sector_analysis && digest.sector_analysis.length > 0;

  // Group picks by sector
  const picksBySector: Record<string, MarketPick[]> = {};
  if (hasSectorData && digest) {
    for (const pick of digest.top_picks) {
      const sector = pick.sector_name || "Khác";
      if (!picksBySector[sector]) picksBySector[sector] = [];
      picksBySector[sector].push(pick);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Market Watch
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Phân tích dòng tiền theo ngành — phát hiện cơ hội đầu tư
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

      {loading && !digest && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Đang tải dữ liệu...</p>
        </div>
      )}

      {refreshing &&
        (pipelineProgress && pipelineProgress.current_stage > 0 ? (
          <PipelineStepper progress={pipelineProgress} />
        ) : (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-600 dark:text-blue-400">
              Đang khởi tạo AI pipeline...
            </span>
          </div>
        ))}

      {refreshError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400">
            Lỗi làm mới: {refreshError}
          </span>
          <button
            type="button"
            onClick={() => setRefreshError(null)}
            className="ml-auto text-xs text-red-400 hover:text-red-600"
          >
            Đóng
          </button>
        </div>
      )}

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
          {/* Market Summary + Mood */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-zinc-400" />
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                Tổng quan thị trường
              </h2>
              {digest.market_mood &&
                MOOD_STYLES[digest.market_mood] != null && (
                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${MOOD_STYLES[digest.market_mood]?.color}`}
                  >
                    {MOOD_STYLES[digest.market_mood]?.label}
                  </span>
                )}
              {digest.pipeline_type === "sector-first" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  Sector-first
                </span>
              )}
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
            <SourceTags
              sources={[...NEWS_SOURCES, { label: "AI: Claude Sonnet" }]}
            />
          </div>

          {/* Expert Assessment */}
          {ytDigest?.digest && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-violet-500" />
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                  Nhận Định Chuyên Gia
                </h2>
                {ytDigest.digest.market_sentiment &&
                  SENTIMENT_STYLES[ytDigest.digest.market_sentiment] && (
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${SENTIMENT_STYLES[ytDigest.digest.market_sentiment]?.color}`}
                    >
                      {
                        SENTIMENT_STYLES[ytDigest.digest.market_sentiment]
                          ?.label
                      }
                    </span>
                  )}
                <span className="text-xs text-zinc-400 ml-auto flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ytDigest.generated_at
                    ? timeAgo(ytDigest.generated_at)
                    : ytDigest.date}
                  <span className="text-zinc-300 dark:text-zinc-600 mx-1">
                    &middot;
                  </span>
                  {ytDigest.videos_processed} video
                </span>
              </div>

              {/* Summary */}
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                {ytDigest.digest.summary}
              </p>

              {/* Consensus Stocks */}
              {ytDigest.digest.consensus_stocks?.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Cổ phiếu nổi bật
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {ytDigest.digest.consensus_stocks.map((s) => (
                      <Link
                        key={s.symbol}
                        href={`/stocks/${s.symbol}`}
                        className={`text-xs font-mono px-2 py-1 rounded-md border transition-colors ${
                          s.avg_sentiment === "bullish"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-100"
                            : s.avg_sentiment === "bearish"
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100"
                              : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-100"
                        }`}
                      >
                        {s.symbol}
                        {s.mentions > 1 && (
                          <span className="ml-1 opacity-60">x{s.mentions}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Hot Sectors */}
              {ytDigest.digest.hot_sectors?.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Ngành được nhắc đến
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {ytDigest.digest.hot_sectors.map((s) => (
                      <span
                        key={s.name}
                        className="text-xs px-2 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800"
                      >
                        {s.name}
                        <span className="ml-1 opacity-60">
                          ({s.mentioned_by?.length || 0} kênh)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Warnings */}
              {ytDigest.digest.risk_warnings?.length > 0 && (
                <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Cảnh báo rủi ro
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {ytDigest.digest.risk_warnings.map((w) => (
                      <li
                        key={w}
                        className="text-xs text-amber-700 dark:text-amber-300"
                      >
                        &bull; {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expandable Video Details */}
              {ytDigest.video_summaries?.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setYtExpanded(!ytExpanded)}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
                  >
                    <span
                      className={`transition-transform ${ytExpanded ? "rotate-90" : ""}`}
                    >
                      &#9654;
                    </span>
                    Chi tiết {ytDigest.video_summaries.length} video
                  </button>
                  {ytExpanded && (
                    <div className="mt-3 space-y-3">
                      {ytDigest.video_summaries.map((v) => (
                        <div
                          key={v.video_id}
                          className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <a
                                href={`https://www.youtube.com/watch?v=${v.video_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              >
                                {v.title}
                                <ExternalLink className="inline h-3 w-3 ml-1 opacity-50" />
                              </a>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {v.channel_name}
                                {v.duration_minutes > 0 &&
                                  ` \u00B7 ${v.duration_minutes} ph\u00FAt`}
                              </p>
                            </div>
                            {v.overall_sentiment &&
                              SENTIMENT_STYLES[v.overall_sentiment] && (
                                <span
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${SENTIMENT_STYLES[v.overall_sentiment]?.color}`}
                                >
                                  {SENTIMENT_STYLES[v.overall_sentiment]?.label}
                                </span>
                              )}
                          </div>
                          {v.stocks_mentioned?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {v.stocks_mentioned.map((s) => (
                                <Link
                                  key={`${v.video_id}-${s.symbol}`}
                                  href={`/stocks/${s.symbol}`}
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                    s.sentiment === "bullish"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                      : s.sentiment === "bearish"
                                        ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                  }`}
                                  title={s.context}
                                >
                                  {s.symbol}
                                </Link>
                              ))}
                            </div>
                          )}
                          {v.key_points?.length > 0 && (
                            <ul className="space-y-0.5">
                              {v.key_points.slice(0, 3).map((p, i) => (
                                <li
                                  key={`kp-${v.video_id}-${i}`}
                                  className="text-xs text-zinc-500 dark:text-zinc-400"
                                >
                                  &bull; {p}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sector Overview Cards */}
          {hasSectorData && (
            <div>
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Ngành nóng
                <span className="text-xs font-normal text-zinc-400">
                  ({digest.sector_analysis?.length} ngành)
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {digest.sector_analysis?.map((sector) => (
                  <SectorCard key={sector.sector_name} sector={sector} />
                ))}
              </div>
            </div>
          )}

          {/* Stock Picks — grouped by sector or flat list */}
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
            ) : hasSectorData ? (
              // Grouped by sector
              <div className="space-y-6">
                {Object.entries(picksBySector).map(
                  ([sectorName, sectorPicks]) => {
                    const sectorInfo = digest.sector_analysis?.find(
                      (s) => s.sector_name === sectorName,
                    );
                    return (
                      <div key={sectorName}>
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {sectorName}
                          </h3>
                          {sectorInfo && (
                            <span className="text-xs text-zinc-400">
                              — {sectorInfo.thesis}
                            </span>
                          )}
                          <span className="text-xs text-zinc-400 ml-auto">
                            {sectorPicks.length} mã
                          </span>
                        </div>
                        <div className="space-y-3">
                          {sectorPicks.map((pick) => (
                            <StockCard key={pick.symbol} pick={pick} />
                          ))}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              // Flat list (backward compatible)
              <div className="space-y-3">
                {digest.top_picks.map((pick) => (
                  <StockCard key={pick.symbol} pick={pick} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

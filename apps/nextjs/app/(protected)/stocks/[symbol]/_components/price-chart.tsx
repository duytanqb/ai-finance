"use client";

import { Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface PriceChartProps {
  symbol: string;
  exchange?: string;
}

type Interval = "1D" | "1W" | "1M";
type Style = "candle" | "line" | "area" | "bar" | "heikinAshi";
type Range = "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y";

interface Study {
  name: string;
  label: string;
  forceOverlay?: boolean;
  input?: Record<string, unknown>;
}

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "Daily", value: "1D" },
  { label: "Weekly", value: "1W" },
  { label: "Monthly", value: "1M" },
];

const STYLES: { label: string; value: Style }[] = [
  { label: "Candle", value: "candle" },
  { label: "Line", value: "line" },
  { label: "Area", value: "area" },
  { label: "Bar", value: "bar" },
  { label: "Heikin Ashi", value: "heikinAshi" },
];

const RANGES: { label: string; value: Range }[] = [
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
];

const AVAILABLE_STUDIES: Study[] = [
  {
    name: "Moving Average Triple",
    label: "MA 50/100/200",
    input: { firstPeriods: 50, secondPeriods: 100, thirdPeriods: 200 },
  },
  { name: "Volume", label: "Volume", forceOverlay: false },
  { name: "Volume Profile Visible Range", label: "Vol Profile" },
  { name: "Bollinger Bands", label: "BB" },
  { name: "RSI", label: "RSI", forceOverlay: false },
  { name: "MACD", label: "MACD", forceOverlay: false },
];

const DEFAULT_STUDIES = [
  "Volume",
  "Volume Profile Visible Range",
  "Moving Average Triple",
];

function PriceChartInner({ symbol, exchange = "HOSE" }: PriceChartProps) {
  const [interval, setInterval] = useState<Interval>("1D");
  const [style, setStyle] = useState<Style>("candle");
  const [range, setRange] = useState<Range>("6M");
  const [activeStudies, setActiveStudies] = useState<string[]>(DEFAULT_STUDIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chartSrc, setChartSrc] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const fetchChart = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);

    const studies = activeStudies
      .map((name) => {
        const def = AVAILABLE_STUDIES.find((s) => s.name === name);
        if (!def) return null;
        const study: Record<string, unknown> = { name: def.name };
        if (def.forceOverlay !== undefined)
          study.forceOverlay = def.forceOverlay;
        if (def.input) study.input = def.input;
        return study;
      })
      .filter(Boolean);

    const body = {
      symbol: `${exchange}:${symbol}`,
      interval,
      style,
      range,
      theme: isDark ? "dark" : "light",
      timezone: "Asia/Ho_Chi_Minh",
      width: 800,
      height: 600,
      studies,
    };

    try {
      const res = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Chart fetch failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setChartSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setLoading(false);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(true);
      setLoading(false);
    }
  }, [symbol, exchange, interval, style, range, activeStudies, isDark]);

  useEffect(() => {
    fetchChart();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchChart]);

  useEffect(() => {
    return () => {
      if (chartSrc) URL.revokeObjectURL(chartSrc);
    };
  }, [chartSrc]);

  const toggleStudy = useCallback((name: string) => {
    setActiveStudies((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }, []);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Style selector */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStyle(s.value)}
              className={`px-2 py-1 transition-colors ${
                style === s.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Interval selector */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          {INTERVALS.map((i) => (
            <button
              key={i.value}
              type="button"
              onClick={() => setInterval(i.value)}
              className={`px-2 py-1 transition-colors ${
                interval === i.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>

        {/* Range selector */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`px-2 py-1 transition-colors ${
                range === r.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Studies toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-500 mr-1">Indicators:</span>
        {AVAILABLE_STUDIES.map((s) => {
          const isActive = activeStudies.includes(s.name);
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => toggleStudy(s.name)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                isActive
                  ? "bg-zinc-900 border-zinc-700 text-white dark:bg-zinc-100 dark:border-zinc-300 dark:text-zinc-900"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Chart image */}
      <div className="relative w-full bg-zinc-50 dark:bg-zinc-900 rounded-lg overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-50/80 dark:bg-zinc-900/80">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        )}
        {error ? (
          <div className="flex flex-col items-center justify-center h-[450px] gap-2">
            <span className="text-sm text-zinc-400">Failed to load chart.</span>
            <button
              type="button"
              onClick={fetchChart}
              className="text-xs px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : chartSrc ? (
          /* biome-ignore lint/performance/noImgElement: blob URL from chart API, not compatible with next/image */
          <img
            src={chartSrc}
            alt={`${symbol} price chart`}
            className="w-full h-auto"
          />
        ) : (
          <div className="h-[450px]" />
        )}
      </div>
    </div>
  );
}

export const PriceChart = memo(PriceChartInner);

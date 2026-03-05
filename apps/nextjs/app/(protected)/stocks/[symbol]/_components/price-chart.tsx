"use client";

import { useTheme } from "@packages/ui/index";
import {
  AreaSeries,
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineSeries,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface PriceChartProps {
  symbol: string;
  exchange?: string;
}

type Interval = "1" | "5" | "15" | "30" | "1H" | "1D" | "1W";
type ChartStyle = "candle" | "line" | "area";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "1H", value: "1H" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
];

const STYLES: { label: string; value: ChartStyle }[] = [
  { label: "Candle", value: "candle" },
  { label: "Line", value: "line" },
  { label: "Area", value: "area" },
];

interface OhlcCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toPriceVND(val: number): number {
  return val * 1000;
}

function toChartTime(unix: number): Time {
  return unix as Time;
}

function getLookbackSeconds(interval: Interval): number {
  switch (interval) {
    case "1":
      return 3 * 86400;
    case "5":
      return 7 * 86400;
    case "15":
      return 14 * 86400;
    case "30":
      return 30 * 86400;
    case "1H":
      return 60 * 86400;
    case "1D":
      return 365 * 86400;
    case "1W":
      return 3 * 365 * 86400;
    default:
      return 365 * 86400;
  }
}

function computeMA(
  candles: OhlcCandle[],
  period: number,
): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      if (c) sum += c.close;
    }
    const candle = candles[i];
    if (candle) {
      result.push({
        time: toChartTime(candle.time),
        value: toPriceVND(sum / period),
      });
    }
  }
  return result;
}

function PriceChartInner({ symbol }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma10SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const { resolvedTheme } = useTheme();
  const [interval, setInterval] = useState<Interval>("1D");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candle");
  const [showMA10, setShowMA10] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = resolvedTheme === "dark";

  const fetchData = useCallback(
    async (res: Interval): Promise<OhlcCandle[]> => {
      const now = Math.floor(Date.now() / 1000);
      const from = now - getLookbackSeconds(res);
      const params = new URLSearchParams({
        source: "dnse",
        interval: res,
        from_ts: String(from),
        to_ts: String(now),
      });
      const resp = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/price?${params}`,
      );
      if (!resp.ok) throw new Error("Failed to fetch price data");
      const json = await resp.json();
      return (json.data || []) as OhlcCandle[];
    },
    [symbol],
  );

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      ma10SeriesRef.current = null;
      ma50SeriesRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? "#27272a" : "#f4f4f5" },
        horzLines: { color: isDark ? "#27272a" : "#f4f4f5" },
      },
      crosshair: {
        vertLine: {
          color: isDark ? "#52525b" : "#d4d4d8",
          labelBackgroundColor: isDark ? "#3f3f46" : "#e4e4e7",
        },
        horzLine: {
          color: isDark ? "#52525b" : "#d4d4d8",
          labelBackgroundColor: isDark ? "#3f3f46" : "#e4e4e7",
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
      },
      timeScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        timeVisible: ["1", "5", "15", "30", "1H"].includes(interval),
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => price.toLocaleString("vi-VN"),
      },
    });

    chartRef.current = chart;

    if (chartStyle === "candle") {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
    } else if (chartStyle === "line") {
      seriesRef.current = chart.addSeries(LineSeries, {
        color: isDark ? "#60a5fa" : "#2563eb",
        lineWidth: 2,
      });
    } else {
      seriesRef.current = chart.addSeries(AreaSeries, {
        topColor: isDark ? "rgba(96,165,250,0.4)" : "rgba(37,99,235,0.4)",
        bottomColor: isDark ? "rgba(96,165,250,0.0)" : "rgba(37,99,235,0.0)",
        lineColor: isDark ? "#60a5fa" : "#2563eb",
        lineWidth: 2,
      });
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    if (showMA10) {
      ma10SeriesRef.current = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MA10",
      });
    }
    if (showMA50) {
      ma50SeriesRef.current = chart.addSeries(LineSeries, {
        color: "#8b5cf6",
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MA50",
      });
    }

    setLoading(true);
    setError(null);
    fetchData(interval)
      .then((candles) => {
        if (!chartRef.current) return;

        if (candles.length === 0) {
          setError("No data available for this period");
          setLoading(false);
          return;
        }

        if (chartStyle === "candle") {
          const candleData = candles.map((c) => ({
            time: toChartTime(c.time),
            open: toPriceVND(c.open),
            high: toPriceVND(c.high),
            low: toPriceVND(c.low),
            close: toPriceVND(c.close),
          })) as CandlestickData[];
          seriesRef.current?.setData(candleData);
        } else {
          const lineData = candles.map((c) => ({
            time: toChartTime(c.time),
            value: toPriceVND(c.close),
          })) as LineData[];
          seriesRef.current?.setData(lineData);
        }

        const volData = candles.map((c) => ({
          time: toChartTime(c.time),
          value: c.volume,
          color:
            c.close >= c.open
              ? isDark
                ? "rgba(34,197,94,0.3)"
                : "rgba(34,197,94,0.4)"
              : isDark
                ? "rgba(239,68,68,0.3)"
                : "rgba(239,68,68,0.4)",
        }));
        volumeSeriesRef.current?.setData(volData);

        if (showMA10) {
          ma10SeriesRef.current?.setData(computeMA(candles, 10));
        }
        if (showMA50) {
          ma50SeriesRef.current?.setData(computeMA(candles, 50));
        }

        chart.timeScale().fitContent();
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
        ma10SeriesRef.current = null;
        ma50SeriesRef.current = null;
      }
    };
  }, [interval, chartStyle, isDark, fetchData, showMA10, showMA50]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setChartStyle(s.value)}
              className={`px-2 py-1 transition-colors ${
                chartStyle === s.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

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

        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowMA10((v) => !v)}
            className={`px-2 py-1 transition-colors ${
              showMA10
                ? "bg-amber-500 text-white"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            MA10
          </button>
          <button
            type="button"
            onClick={() => setShowMA50((v) => !v)}
            className={`px-2 py-1 transition-colors ${
              showMA50
                ? "bg-violet-500 text-white"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            MA50
          </button>
        </div>

        <span className="text-[10px] text-zinc-400 ml-auto">DNSE</span>
      </div>

      <div className="relative w-full h-[500px] rounded-lg overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80 dark:bg-zinc-950/80">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

export const PriceChart = memo(PriceChartInner);

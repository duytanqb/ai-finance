"use client";

import { useTheme } from "@packages/ui/index";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface PriceChartProps {
  symbol: string;
  exchange?: string;
}

type Interval = "D" | "W" | "M";
type Style = "1" | "2" | "3" | "0" | "8";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "Daily", value: "D" },
  { label: "Weekly", value: "W" },
  { label: "Monthly", value: "M" },
];

const STYLES: { label: string; value: Style }[] = [
  { label: "Candle", value: "1" },
  { label: "Line", value: "2" },
  { label: "Area", value: "3" },
  { label: "Bar", value: "0" },
  { label: "Heikin Ashi", value: "8" },
];

interface StudyDef {
  id: string;
  label: string;
}

const AVAILABLE_STUDIES: StudyDef[] = [
  { id: "MASimple@tv-basicstudies", label: "MA" },
  { id: "BB@tv-basicstudies", label: "BB" },
  { id: "RSI@tv-basicstudies", label: "RSI" },
  { id: "MACD@tv-basicstudies", label: "MACD" },
];

const DEFAULT_STUDIES = ["MASimple@tv-basicstudies"];

const WIDGET_SCRIPT_URL =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

function PriceChartInner({ symbol, exchange = "HOSE" }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [interval, setInterval] = useState<Interval>("D");
  const [style, setStyle] = useState<Style>("1");
  const [activeStudies, setActiveStudies] = useState<string[]>(DEFAULT_STUDIES);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";

    const innerDiv = document.createElement("div");
    innerDiv.className = "tradingview-widget-container__widget";
    innerDiv.style.height = "calc(100% - 32px)";
    innerDiv.style.width = "100%";
    widgetDiv.appendChild(innerDiv);

    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: `${exchange}:${symbol}`,
      interval,
      timezone: "Asia/Ho_Chi_Minh",
      theme: resolvedTheme === "dark" ? "dark" : "light",
      style,
      locale: "vi_VN",
      allow_symbol_change: false,
      withdateranges: true,
      hide_side_toolbar: false,
      studies: activeStudies,
      save_image: true,
      support_host: "https://www.tradingview.com",
    });

    widgetDiv.appendChild(script);
    container.appendChild(widgetDiv);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, exchange, interval, style, activeStudies, resolvedTheme]);

  const toggleStudy = useCallback((id: string) => {
    setActiveStudies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
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
      </div>

      {/* Studies toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-500 mr-1">Indicators:</span>
        {AVAILABLE_STUDIES.map((s) => {
          const isActive = activeStudies.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleStudy(s.id)}
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

      {/* TradingView Widget */}
      <div
        ref={containerRef}
        className="w-full h-[500px] rounded-lg overflow-hidden"
      />
    </div>
  );
}

export const PriceChart = memo(PriceChartInner);

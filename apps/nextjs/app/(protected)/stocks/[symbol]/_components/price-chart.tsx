"use client";

import { useMemo } from "react";

interface PricePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PriceChartProps {
  data: PricePoint[];
}

export function PriceChart({ data }: PriceChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const width = 800;
    const height = 300;
    const padding = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1)) * chartW,
      y: padding.top + (1 - (d.close - min) / range) * chartH,
      close: d.close,
      time: d.time,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const areaPath =
      lastPoint && firstPoint
        ? `${linePath} L ${lastPoint.x} ${padding.top + chartH} L ${firstPoint.x} ${padding.top + chartH} Z`
        : "";

    // Y-axis labels (5 levels)
    const yLabels = Array.from({ length: 5 }, (_, i) => {
      const value = min + (range * i) / 4;
      const y = padding.top + (1 - i / 4) * chartH;
      return { value: Math.round(value).toLocaleString("vi-VN"), y };
    });

    // X-axis labels (show ~5 dates)
    const step = Math.max(1, Math.floor(data.length / 5));
    const xLabels = data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d, _idx) => ({
        label: d.time.slice(5),
        x: padding.left + (data.indexOf(d) / (data.length - 1)) * chartW,
      }));

    const lastData = data[data.length - 1];
    const firstData = data[0];
    const isPositive =
      lastData && firstData ? lastData.close >= firstData.close : true;

    return {
      width,
      height,
      linePath,
      areaPath,
      yLabels,
      xLabels,
      padding,
      chartH,
      isPositive,
    };
  }, [data]);

  if (!data.length || !chartData) {
    return (
      <div className="flex items-center justify-center h-[300px] text-zinc-400 text-sm">
        No price data available
      </div>
    );
  }

  const {
    width,
    height,
    linePath,
    areaPath,
    yLabels,
    xLabels,
    padding,
    chartH,
    isPositive,
  } = chartData;
  const strokeColor = isPositive ? "#059669" : "#ef4444";
  const fillColor = isPositive
    ? "rgba(5, 150, 105, 0.1)"
    : "rgba(239, 68, 68, 0.1)";

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[300px]">
        {/* Grid lines */}
        {yLabels.map((label) => (
          <line
            key={label.y}
            x1={padding.left}
            y1={label.y}
            x2={width - padding.right}
            y2={label.y}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={fillColor} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={2} />

        {/* Y-axis labels */}
        {yLabels.map((label) => (
          <text
            key={label.y}
            x={width - padding.right + 8}
            y={label.y + 4}
            className="fill-zinc-400 text-[10px] font-mono"
          >
            {label.value}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label) => (
          <text
            key={label.x}
            x={label.x}
            y={padding.top + chartH + 20}
            textAnchor="middle"
            className="fill-zinc-400 text-[10px]"
          >
            {label.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

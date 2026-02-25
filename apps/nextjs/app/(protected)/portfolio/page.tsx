"use client";

import { ArrowDownRight, ArrowUpRight, Plus, Sparkles } from "lucide-react";

const MOCK_HOLDINGS = [
  {
    symbol: "VCB",
    name: "Vietcombank",
    quantity: 500,
    avgPrice: "82,000",
    currentPrice: "88,500",
    pnl: "+3,250,000",
    pnlPercent: "+7.9%",
    horizon: "long-term",
    positive: true,
  },
  {
    symbol: "FPT",
    name: "FPT Corp",
    quantity: 200,
    avgPrice: "125,000",
    currentPrice: "132,800",
    pnl: "+1,560,000",
    pnlPercent: "+6.2%",
    horizon: "hold-forever",
    positive: true,
  },
  {
    symbol: "HPG",
    name: "Hoa Phat",
    quantity: 1000,
    avgPrice: "28,500",
    currentPrice: "26,200",
    pnl: "-2,300,000",
    pnlPercent: "-8.1%",
    horizon: "medium-term",
    positive: false,
  },
];

const HORIZON_COLORS: Record<string, string> = {
  "short-term":
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "medium-term":
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "long-term":
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "hold-forever":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function PortfolioPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Portfolio
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track holdings and get AI suggestions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Review
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Value" value="152,460,000 VND" />
        <SummaryCard label="Total P&L" value="+2,510,000 VND" positive />
        <SummaryCard label="Win Rate" value="66.7%" />
        <SummaryCard label="Holdings" value="3 stocks" />
      </div>

      {/* Holdings Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Stock
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Qty
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Avg Price
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Current
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                P&L
              </th>
              <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Horizon
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_HOLDINGS.map((h) => (
              <tr
                key={h.symbol}
                className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {h.symbol}
                  </div>
                  <div className="text-xs text-zinc-500">{h.name}</div>
                </td>
                <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                  {h.quantity}
                </td>
                <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                  {h.avgPrice}
                </td>
                <td className="px-5 py-3 text-right text-sm font-mono text-zinc-900 dark:text-zinc-100">
                  {h.currentPrice}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {h.positive ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-sm font-medium ${h.positive ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {h.pnlPercent}
                    </span>
                  </div>
                  <div
                    className={`text-xs ${h.positive ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {h.pnl}
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${HORIZON_COLORS[h.horizon]}`}
                  >
                    {h.horizon}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-lg font-bold mt-1 ${positive === true ? "text-emerald-600" : positive === false ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"}`}
      >
        {value}
      </p>
    </div>
  );
}

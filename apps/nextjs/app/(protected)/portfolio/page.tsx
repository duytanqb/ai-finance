"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  horizon: string;
  createdAt: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

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

const HORIZONS = [
  { value: "short-term", label: "Short-term" },
  { value: "medium-term", label: "Medium-term" },
  { value: "long-term", label: "Long-term" },
  { value: "hold-forever", label: "Hold Forever" },
];

function formatVND(value: number): string {
  return value.toLocaleString("vi-VN");
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formSymbol, setFormSymbol] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formAvgPrice, setFormAvgPrice] = useState("");
  const [formHorizon, setFormHorizon] = useState("medium-term");

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      const data = await res.json();
      const holdingsData: Holding[] = data.holdings || [];

      const symbols = holdingsData.map((h) => h.symbol);
      const priceMap: Record<
        string,
        { price: number; change: number; changePercent: number }
      > = {};

      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const priceRes = await fetch(`/api/stocks/${sym}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              const board = Array.isArray(priceData) ? priceData[0] : priceData;
              const boardData = board?.data
                ? Array.isArray(board.data)
                  ? board.data[0]
                  : board.data
                : board;
              if (boardData && !boardData.error && boardData.match_price) {
                priceMap[sym] = {
                  price: boardData.match_price,
                  change: boardData.change || 0,
                  changePercent: boardData.pct_change || 0,
                };
              }
            }
          } catch {
            // skip price fetch errors
          }
        }),
      );

      const enriched = holdingsData.map((h) => ({
        ...h,
        currentPrice: priceMap[h.symbol]?.price,
        change: priceMap[h.symbol]?.change,
        changePercent: priceMap[h.symbol]?.changePercent,
      }));

      setHoldings(enriched);
    } catch {
      setError("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: formSymbol.toUpperCase(),
          quantity: Number(formQuantity),
          averagePrice: Number(formAvgPrice),
          horizon: formHorizon,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add holding");
      }

      setShowAddForm(false);
      setFormSymbol("");
      setFormQuantity("");
      setFormAvgPrice("");
      setFormHorizon("medium-term");
      setLoading(true);
      fetchHoldings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holding");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (!confirm(`Remove ${symbol} from portfolio?`)) return;

    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove holding");
      }
      setHoldings((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove holding");
    }
  };

  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.currentPrice || h.averagePrice) * h.quantity,
    0,
  );
  const totalCost = holdings.reduce(
    (sum, h) => sum + h.averagePrice * h.quantity,
    0,
  );
  const totalPnl = totalValue - totalCost;
  const winCount = holdings.filter(
    (h) => h.currentPrice && h.currentPrice > h.averagePrice,
  ).length;
  const winRate =
    holdings.length > 0
      ? ((winCount / holdings.length) * 100).toFixed(1)
      : "0.0";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

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
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Holding
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Add Holding Form */}
      {showAddForm && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Add Holding
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Symbol
                <input
                  type="text"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  placeholder="VCB"
                  required
                  className="mt-1 block w-24 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Quantity
                <input
                  type="number"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  placeholder="100"
                  required
                  min="1"
                  className="mt-1 block w-28 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Avg Price (VND)
                <input
                  type="number"
                  value={formAvgPrice}
                  onChange={(e) => setFormAvgPrice(e.target.value)}
                  placeholder="85000"
                  required
                  min="1"
                  className="mt-1 block w-32 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Horizon
                <select
                  value={formHorizon}
                  onChange={(e) => setFormHorizon(e.target.value)}
                  className="mt-1 block px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {HORIZONS.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {adding ? "Adding..." : "Add"}
            </button>
          </form>
        </div>
      )}

      {/* Portfolio Summary */}
      {holdings.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Total Value"
            value={`${formatVND(Math.round(totalValue))} VND`}
          />
          <SummaryCard
            label="Total P&L"
            value={`${totalPnl >= 0 ? "+" : ""}${formatVND(Math.round(totalPnl))} VND`}
            positive={totalPnl >= 0}
          />
          <SummaryCard label="Win Rate" value={`${winRate}%`} />
          <SummaryCard
            label="Holdings"
            value={`${holdings.length} stock${holdings.length !== 1 ? "s" : ""}`}
          />
        </div>
      )}

      {/* Holdings Table */}
      {holdings.length > 0 ? (
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
                <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const current = h.currentPrice || h.averagePrice;
                const pnl = (current - h.averagePrice) * h.quantity;
                const pnlPercent =
                  h.averagePrice > 0
                    ? ((current - h.averagePrice) / h.averagePrice) * 100
                    : 0;
                const positive = pnl >= 0;

                return (
                  <tr
                    key={h.id}
                    className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {h.symbol}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {formatVND(h.quantity)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {formatVND(h.averagePrice)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-zinc-900 dark:text-zinc-100">
                      {h.currentPrice ? formatVND(h.currentPrice) : "-"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {positive ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <span
                          className={`text-sm font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {positive ? "+" : ""}
                          {pnlPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        className={`text-xs ${positive ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {positive ? "+" : ""}
                        {formatVND(Math.round(pnl))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${HORIZON_COLORS[h.horizon] || ""}`}
                      >
                        {h.horizon}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id, h.symbol)}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
          <Plus className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Your portfolio is empty</p>
          <p className="text-xs mt-1">Add holdings to start tracking</p>
        </div>
      )}
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

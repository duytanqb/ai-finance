"use client";

import { Eye, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface WatchlistItem {
  id: string;
  symbol: string;
  targetPrice: number | null;
  notes: string | null;
  createdAt: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formSymbol, setFormSymbol] = useState("");
  const [formTargetPrice, setFormTargetPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      const data = await res.json();
      const itemsData: WatchlistItem[] = data.items || [];

      const symbols = itemsData.map((item) => item.symbol);
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

      const enriched = itemsData.map((item) => ({
        ...item,
        currentPrice: priceMap[item.symbol]?.price,
        change: priceMap[item.symbol]?.change,
        changePercent: priceMap[item.symbol]?.changePercent,
      }));

      setItems(enriched);
    } catch {
      setError("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        symbol: formSymbol.toUpperCase(),
      };
      if (formTargetPrice) body.targetPrice = Number(formTargetPrice);
      if (formNotes.trim()) body.notes = formNotes.trim();

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add to watchlist");
      }

      setShowAddForm(false);
      setFormSymbol("");
      setFormTargetPrice("");
      setFormNotes("");
      setLoading(true);
      fetchWatchlist();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add to watchlist",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (!confirm(`Remove ${symbol} from watchlist?`)) return;

    try {
      const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove item");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Watchlist
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Monitor stocks and set price targets
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Stock
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Add to Watchlist Form */}
      {showAddForm && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Add to Watchlist
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
                Target Price (VND)
                <input
                  type="number"
                  value={formTargetPrice}
                  onChange={(e) => setFormTargetPrice(e.target.value)}
                  placeholder="Optional"
                  min="1"
                  className="mt-1 block w-32 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-zinc-500 mb-1">
                Notes
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes"
                  maxLength={500}
                  className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
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

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const distanceToTarget =
              item.targetPrice && item.currentPrice
                ? ((item.targetPrice - item.currentPrice) / item.currentPrice) *
                  100
                : null;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {item.symbol}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                      {item.currentPrice
                        ? item.currentPrice.toLocaleString("vi-VN")
                        : "-"}
                    </div>
                    {item.changePercent !== undefined && (
                      <div
                        className={`text-xs font-medium ${(item.changePercent || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {(item.changePercent || 0) >= 0 ? "+" : ""}
                        {item.changePercent?.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {item.targetPrice && (
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Target</div>
                      <div className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                        {item.targetPrice.toLocaleString("vi-VN")}
                      </div>
                      {distanceToTarget !== null && (
                        <div
                          className={`text-xs ${distanceToTarget > 0 ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {distanceToTarget > 0 ? "+" : ""}
                          {distanceToTarget.toFixed(1)}% to target
                        </div>
                      )}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-right max-w-[200px]">
                      <div className="text-xs text-zinc-500">Note</div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                        {item.notes}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.symbol)}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
          <Eye className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Your watchlist is empty</p>
          <p className="text-xs mt-1">Add stocks to monitor their prices</p>
        </div>
      )}
    </div>
  );
}

"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface WatchlistItem {
  id: string;
  symbol: string;
  targetPrice: number | null;
  notes: string | null;
  createdAt: string;
  currentPrice?: number;
  refPrice?: number;
  change?: number;
  changePercent?: number;
  highest?: number;
  lowest?: number;
  volume?: number;
}

function formatVND(value: number | undefined | null): string {
  if (value === undefined || value === null) return "-";
  return value.toLocaleString("vi-VN");
}

function formatVolume(vol: number | undefined): string {
  if (!vol) return "-";
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return vol.toLocaleString("vi-VN");
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
        {
          price: number;
          refPrice: number;
          change: number;
          changePercent: number;
          highest: number;
          lowest: number;
          volume: number;
        }
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
                  refPrice:
                    boardData.ref_price || boardData.reference_price || 0,
                  change: boardData.change || 0,
                  changePercent: boardData.pct_change || 0,
                  highest: boardData.highest || boardData.high || 0,
                  lowest: boardData.lowest || boardData.low || 0,
                  volume:
                    boardData.total_volume ||
                    boardData.match_vol ||
                    boardData.total_match_vol ||
                    0,
                };
              }
            }
          } catch {
            // skip
          }
        }),
      );

      const enriched = itemsData.map((item) => ({
        ...item,
        currentPrice: priceMap[item.symbol]?.price,
        refPrice: priceMap[item.symbol]?.refPrice,
        change: priceMap[item.symbol]?.change,
        changePercent: priceMap[item.symbol]?.changePercent,
        highest: priceMap[item.symbol]?.highest,
        lowest: priceMap[item.symbol]?.lowest,
        volume: priceMap[item.symbol]?.volume,
      }));

      setItems(enriched);
    } catch {
      setError("Không thể tải danh sách theo dõi");
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
        throw new Error(data.error || "Failed to add");
      }

      setShowAddForm(false);
      setFormSymbol("");
      setFormTargetPrice("");
      setFormNotes("");
      setLoading(true);
      fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thêm thất bại");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (!confirm(`Xóa ${symbol} khỏi danh sách theo dõi?`)) return;

    try {
      const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const gainers = items.filter((i) => (i.changePercent || 0) > 0).length;
  const losers = items.filter((i) => (i.changePercent || 0) < 0).length;
  const nearTarget = items.filter((i) => {
    if (!i.targetPrice || !i.currentPrice) return false;
    const dist = Math.abs(
      ((i.targetPrice - i.currentPrice) / i.currentPrice) * 100,
    );
    return dist <= 5;
  }).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Danh sách theo dõi
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Theo dõi giá và đặt mục tiêu cho cổ phiếu quan tâm
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex items-center justify-between">
          <span className="text-sm text-red-600 dark:text-red-400">
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Thêm cổ phiếu theo dõi
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
                Mã CK
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
                Giá mục tiêu (VND)
                <input
                  type="number"
                  value={formTargetPrice}
                  onChange={(e) => setFormTargetPrice(e.target.value)}
                  placeholder="Tùy chọn"
                  min="1"
                  className="mt-1 block w-32 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-zinc-500 mb-1">
                Ghi chú
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú tùy chọn"
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
              {adding ? "Đang thêm..." : "Thêm"}
            </button>
          </form>
        </div>
      )}

      {/* Summary Cards */}
      {items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Theo dõi" value={`${items.length} mã`} />
          <SummaryCard
            label="Tăng giá"
            value={`${gainers} mã`}
            positive={gainers > 0 ? true : undefined}
          />
          <SummaryCard
            label="Giảm giá"
            value={`${losers} mã`}
            positive={losers > 0 ? false : undefined}
          />
          <SummaryCard label="Gần mục tiêu" value={`${nearTarget} mã`} />
        </div>
      )}

      {/* Watchlist Table */}
      {items.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Mã CK
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Giá
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Thay đổi
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Tham chiếu
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Cao / Thấp
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    KL
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Mục tiêu
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Ghi chú
                  </th>
                  <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const positive = (item.changePercent || 0) >= 0;
                  const distToTarget =
                    item.targetPrice && item.currentPrice
                      ? ((item.targetPrice - item.currentPrice) /
                          item.currentPrice) *
                        100
                      : null;
                  const nearingTarget =
                    distToTarget !== null && Math.abs(distToTarget) <= 5;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      {/* Symbol */}
                      <td className="px-5 py-3">
                        <Link
                          href={`/stocks/${item.symbol}`}
                          className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                        >
                          {item.symbol}
                        </Link>
                      </td>

                      {/* Current Price */}
                      <td className="px-5 py-3 text-right text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {formatVND(item.currentPrice)}
                      </td>

                      {/* Change */}
                      <td className="px-5 py-3 text-right">
                        {item.changePercent !== undefined ? (
                          <div className="flex items-center justify-end gap-1">
                            {positive ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <div>
                              <span
                                className={`text-sm font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
                              >
                                {positive ? "+" : ""}
                                {item.changePercent?.toFixed(2)}%
                              </span>
                              <div
                                className={`text-xs ${positive ? "text-emerald-600" : "text-red-500"}`}
                              >
                                {positive ? "+" : ""}
                                {formatVND(item.change)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">-</span>
                        )}
                      </td>

                      {/* Ref Price */}
                      <td className="px-5 py-3 text-right text-sm font-mono text-zinc-500">
                        {formatVND(item.refPrice)}
                      </td>

                      {/* High / Low */}
                      <td className="px-5 py-3 text-right">
                        {item.highest || item.lowest ? (
                          <div className="text-xs font-mono">
                            <span className="text-emerald-600">
                              {formatVND(item.highest)}
                            </span>
                            <span className="text-zinc-400"> / </span>
                            <span className="text-red-500">
                              {formatVND(item.lowest)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">-</span>
                        )}
                      </td>

                      {/* Volume */}
                      <td className="px-5 py-3 text-right text-sm font-mono text-zinc-500">
                        {formatVolume(item.volume)}
                      </td>

                      {/* Target Price */}
                      <td className="px-5 py-3 text-right">
                        {item.targetPrice ? (
                          <div>
                            <div className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                              {formatVND(item.targetPrice)}
                            </div>
                            {distToTarget !== null && (
                              <div
                                className={`text-xs font-medium ${
                                  nearingTarget
                                    ? "text-amber-500"
                                    : distToTarget > 0
                                      ? "text-emerald-600"
                                      : "text-red-500"
                                }`}
                              >
                                {distToTarget > 0 ? "+" : ""}
                                {distToTarget.toFixed(1)}%
                                {nearingTarget && " !"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-5 py-3">
                        {item.notes ? (
                          <span
                            className="text-xs text-zinc-500 line-clamp-2 max-w-[180px]"
                            title={item.notes}
                          >
                            {item.notes}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300 dark:text-zinc-700">
                            -
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/stocks/${item.symbol}`}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition-colors"
                            title="Phân tích chi tiết"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.symbol)}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
          <Eye className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Danh sách theo dõi trống</p>
          <p className="text-xs mt-1">
            Thêm cổ phiếu để theo dõi giá và đặt mục tiêu
          </p>
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

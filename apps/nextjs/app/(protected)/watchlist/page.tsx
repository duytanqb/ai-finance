"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Brain,
  Eye,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketRefresh } from "@/lib/use-market-refresh";

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

interface MA50Signal {
  symbol: string;
  current_price: number;
  ma50: number | null;
  ma10: number | null;
  ma20: number | null;
  price_vs_ma50: string;
  ma50_distance_pct: number | null;
  ma10_vs_ma50: string | null;
  rsi_14: number | null;
  volume_ratio_5d_vs_20d: number | null;
  signal: string;
  confidence: string;
  suggested_buy_price: number | null;
  reasoning: string;
  error?: string;
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

function SignalPopover({
  sig,
  onClose,
}: {
  sig: MA50Signal;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        ref={ref}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-5 max-w-md w-full mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {sig.symbol}
            </span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                sig.signal === "BUY"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : sig.signal === "SELL"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {sig.signal}
            </span>
            <span className="text-xs text-zinc-400">{sig.confidence}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        {/* Technical data grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2">
            <span className="text-zinc-500">Giá hiện tại</span>
            <p className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {formatVND(sig.current_price)}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2">
            <span className="text-zinc-500">MA50</span>
            <p className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {sig.ma50 != null ? formatVND(sig.ma50) : "-"}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2">
            <span className="text-zinc-500">MA10 / MA20</span>
            <p className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {sig.ma10 != null ? formatVND(sig.ma10) : "-"}
              {" / "}
              {sig.ma20 != null ? formatVND(sig.ma20) : "-"}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2">
            <span className="text-zinc-500">RSI(14)</span>
            <p
              className={`font-mono font-medium ${
                sig.rsi_14 != null && sig.rsi_14 > 70
                  ? "text-red-500"
                  : sig.rsi_14 != null && sig.rsi_14 < 30
                    ? "text-emerald-600"
                    : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {sig.rsi_14 != null ? sig.rsi_14.toFixed(1) : "-"}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2">
            <span className="text-zinc-500">Vị trí MA50</span>
            <p
              className={`font-medium ${
                sig.price_vs_ma50 === "above"
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {sig.price_vs_ma50 === "above" ? "Trên" : "Dưới"} MA50
              {sig.ma50_distance_pct != null && (
                <span className="text-zinc-500 ml-1">
                  ({sig.ma50_distance_pct > 0 ? "+" : ""}
                  {sig.ma50_distance_pct.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2">
            <span className="text-zinc-500">KL 5d/20d</span>
            <p
              className={`font-mono font-medium ${
                sig.volume_ratio_5d_vs_20d != null &&
                sig.volume_ratio_5d_vs_20d > 1.5
                  ? "text-emerald-600"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {sig.volume_ratio_5d_vs_20d != null
                ? `${sig.volume_ratio_5d_vs_20d.toFixed(2)}x`
                : "-"}
            </p>
          </div>
        </div>

        {/* Suggested buy price */}
        {sig.suggested_buy_price != null && (
          <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                Giá mua gợi ý
              </span>
              <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">
                {formatVND(sig.suggested_buy_price)}
              </span>
            </div>
            {sig.current_price && sig.suggested_buy_price && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {sig.suggested_buy_price <= sig.current_price
                  ? `${(((sig.current_price - sig.suggested_buy_price) / sig.current_price) * 100).toFixed(1)}% thấp hơn giá hiện tại`
                  : `${(((sig.suggested_buy_price - sig.current_price) / sig.current_price) * 100).toFixed(1)}% cao hơn giá hiện tại`}
              </p>
            )}
          </div>
        )}

        {/* Full reasoning */}
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Nhận định AI</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {sig.reasoning || "Không có nhận định"}
          </p>
        </div>

        {sig.ma10_vs_ma50 && (
          <div className="mt-3 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                sig.ma10_vs_ma50 === "golden_cross"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : sig.ma10_vs_ma50 === "death_cross"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {sig.ma10_vs_ma50 === "golden_cross"
                ? "Golden Cross"
                : sig.ma10_vs_ma50 === "death_cross"
                  ? "Death Cross"
                  : sig.ma10_vs_ma50}
            </span>
          </div>
        )}
      </div>
    </div>
  );
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

  const [signals, setSignals] = useState<Record<string, MA50Signal>>({});
  const [reviewing, setReviewing] = useState(false);
  const [showSignals, setShowSignals] = useState(false);
  const [popoverSignal, setPopoverSignal] = useState<MA50Signal | null>(null);

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

  const fetchCachedSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist/signals");
      if (res.ok) {
        const data = await res.json();
        if (data.signals && Object.keys(data.signals).length > 0) {
          setSignals(data.signals);
          setShowSignals(true);
        }
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    fetchCachedSignals();
  }, [fetchWatchlist, fetchCachedSignals]);

  useMarketRefresh(fetchWatchlist);

  const handleAIReview = async () => {
    if (items.length === 0) return;
    setReviewing(true);
    setError(null);

    try {
      const res = await fetch("/api/watchlist/review", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "AI review failed");
      }
      const data = await res.json();
      const results: MA50Signal[] = data.results || [];
      const signalMap: Record<string, MA50Signal> = {};
      for (const r of results) {
        signalMap[r.symbol] = r;
      }
      setSignals(signalMap);
      setShowSignals(true);

      // Refresh watchlist to get updated targetPrice from AI suggestion
      fetchWatchlist();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI Review không thành công",
      );
    } finally {
      setReviewing(false);
    }
  };

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

  const buySignals = Object.values(signals).filter(
    (s) => s.signal === "BUY",
  ).length;

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
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleAIReview}
              disabled={reviewing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {reviewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5" />
              )}
              {reviewing ? "Đang phân tích..." : "AI Review MA50"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm
          </button>
        </div>
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
          {showSignals ? (
            <SummaryCard
              label="Tín hiệu MUA"
              value={`${buySignals} mã`}
              positive={buySignals > 0 ? true : undefined}
            />
          ) : (
            <SummaryCard label="Gần mục tiêu" value={`${nearTarget} mã`} />
          )}
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
                  {showSignals && (
                    <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                      MA50
                    </th>
                  )}
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Mục tiêu
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    KL
                  </th>
                  {showSignals && (
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                      Nhận định AI
                    </th>
                  )}
                  {!showSignals && (
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                      Ghi chú
                    </th>
                  )}
                  <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const positive = (item.changePercent || 0) >= 0;
                  const sig = signals[item.symbol];
                  const displayTarget =
                    sig?.suggested_buy_price ?? item.targetPrice;
                  const distToTarget =
                    displayTarget && item.currentPrice
                      ? ((displayTarget - item.currentPrice) /
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

                      {/* MA50 Signal */}
                      {showSignals && (
                        <td className="px-5 py-3 text-center">
                          {sig ? (
                            sig.error ? (
                              <span className="text-xs text-zinc-400">N/A</span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    sig.price_vs_ma50 === "above"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  }`}
                                >
                                  {sig.price_vs_ma50 === "above" ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {sig.price_vs_ma50 === "above"
                                    ? "Trên MA50"
                                    : "Dưới MA50"}
                                </span>
                                {sig.ma50_distance_pct != null && (
                                  <span className="text-xs text-zinc-500">
                                    {sig.ma50_distance_pct > 0 ? "+" : ""}
                                    {sig.ma50_distance_pct.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-zinc-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Target / Suggested Buy Price */}
                      <td className="px-5 py-3 text-right">
                        {displayTarget ? (
                          <div>
                            <div className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                              {formatVND(displayTarget)}
                            </div>
                            {sig?.suggested_buy_price && (
                              <div className="text-xs text-blue-500">
                                AI gợi ý
                              </div>
                            )}
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

                      {/* Volume */}
                      <td className="px-5 py-3 text-right text-sm font-mono text-zinc-500">
                        {formatVolume(item.volume)}
                      </td>

                      {/* AI Signal or Notes */}
                      {showSignals ? (
                        <td className="px-5 py-3">
                          {sig && !sig.error ? (
                            <button
                              type="button"
                              onClick={() => setPopoverSignal(sig)}
                              className="text-left cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                  sig.signal === "BUY"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : sig.signal === "SELL"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}
                              >
                                {sig.signal}
                              </span>
                              {sig.reasoning && (
                                <p className="text-xs text-zinc-500 mt-1 line-clamp-2 max-w-[240px] underline decoration-dotted decoration-zinc-300 dark:decoration-zinc-600">
                                  {sig.reasoning}
                                </p>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400">-</span>
                          )}
                        </td>
                      ) : (
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
                      )}

                      {/* Actions */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/trading?symbol=${item.symbol}&side=BUY`}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500 transition-colors"
                            title="Giao dịch"
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Link>
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

      {/* Signal Detail Popover */}
      {popoverSignal && (
        <SignalPopover
          sig={popoverSignal}
          onClose={() => setPopoverSignal(null)}
        />
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

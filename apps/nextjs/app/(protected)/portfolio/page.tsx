"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  horizon: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  createdAt: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
  dividendYield?: number;
}

interface AIHoldingReview {
  symbol: string;
  action: string;
  reasoning: string;
  urgency: string;
  suggested_stop_loss?: number | null;
  suggested_take_profit?: number | null;
}

interface AIReviewResult {
  holdings: AIHoldingReview[];
  portfolio_summary: string;
}

const HORIZON_LABELS: Record<string, string> = {
  "short-term": "Ngắn hạn",
  "medium-term": "Trung hạn",
  "long-term": "Dài hạn",
  "hold-forever": "Nắm giữ",
};

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

const ACTION_COLORS: Record<string, string> = {
  HOLD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SELL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ADD_MORE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const HORIZONS = [
  { value: "short-term", label: "Ngắn hạn (< 1 tháng)" },
  { value: "medium-term", label: "Trung hạn (1-6 tháng)" },
  { value: "long-term", label: "Dài hạn (6-12 tháng)" },
  { value: "hold-forever", label: "Nắm giữ (> 1 năm)" },
];

function formatVND(value: number): string {
  return value.toLocaleString("vi-VN");
}

function formatAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "vừa xong";
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    quantity: "",
    averagePrice: "",
    horizon: "",
    stopLoss: "",
    takeProfit: "",
  });
  const [saving, setSaving] = useState(false);

  const [aiReview, setAiReview] = useState<AIReviewResult | null>(null);
  const [aiReviewAge, setAiReviewAge] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [bgResearchSymbols, setBgResearchSymbols] = useState<string[]>([]);
  const [staleResearchSymbols, setStaleResearchSymbols] = useState<string[]>(
    [],
  );
  const [dismissedResearchAlert, setDismissedResearchAlert] = useState(false);

  const [formSymbol, setFormSymbol] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formAvgPrice, setFormAvgPrice] = useState("");
  const [formHorizon, setFormHorizon] = useState("medium-term");
  const [formStopLoss, setFormStopLoss] = useState("");
  const [formTakeProfit, setFormTakeProfit] = useState("");

  const fetchHoldings = useCallback(async () => {
    try {
      const [res, reviewRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/reports?symbol=PORTFOLIO&type=portfolio_review"),
      ]);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      const data = await res.json();
      const holdingsData: Holding[] = data.holdings || [];

      if (reviewRes.ok) {
        const reports = await reviewRes.json();
        if (Array.isArray(reports) && reports.length > 0) {
          setAiReview(reports[0].result as AIReviewResult);
          setAiReviewAge(reports[0].createdAt);
        }
      }

      const symbols = holdingsData.map((h) => h.symbol);
      const priceMap: Record<
        string,
        { price: number; change: number; changePercent: number }
      > = {};
      const dividendMap: Record<string, number> = {};

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

      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const ratioRes = await fetch(`/api/stocks/${sym}/financials`);
            if (ratioRes.ok) {
              const ratioData = await ratioRes.json();
              const ratios = Array.isArray(ratioData?.data)
                ? ratioData.data[0]
                : ratioData?.data;
              const dy =
                ratios?.dividend_yield ?? ratios?.dividendYield ?? null;
              if (dy != null && dy > 0) {
                dividendMap[sym] = dy;
              }
            }
          } catch {
            // skip
          }
        }),
      );

      const enriched = holdingsData.map((h) => ({
        ...h,
        currentPrice: priceMap[h.symbol]?.price,
        change: priceMap[h.symbol]?.change,
        changePercent: priceMap[h.symbol]?.changePercent,
        dividendYield: dividendMap[h.symbol],
      }));

      setHoldings(enriched);

      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const stale: string[] = [];
      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const res = await fetch(
              `/api/reports?symbol=${sym}&type=deep_research`,
            );
            if (!res.ok) {
              stale.push(sym);
              return;
            }
            const reports = await res.json();
            if (
              !Array.isArray(reports) ||
              reports.length === 0 ||
              Date.now() - new Date(reports[0].createdAt).getTime() > SEVEN_DAYS
            ) {
              stale.push(sym);
            }
          } catch {
            stale.push(sym);
          }
        }),
      );
      setStaleResearchSymbols(stale);
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
          stopLoss: formStopLoss ? Number(formStopLoss) : undefined,
          takeProfit: formTakeProfit ? Number(formTakeProfit) : undefined,
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
      setFormStopLoss("");
      setFormTakeProfit("");
      setLoading(true);
      fetchHoldings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holding");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (!confirm(`Xóa ${symbol} khỏi danh mục?`)) return;

    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove holding");
      }
      setHoldings((prev) => prev.filter((h) => h.id !== id));
      setAiReview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove holding");
    }
  };

  const startEdit = (h: Holding) => {
    setEditingId(h.id);
    setEditData({
      quantity: String(h.quantity),
      averagePrice: String(h.averagePrice),
      horizon: h.horizon,
      stopLoss: h.stopLoss ? String(h.stopLoss) : "",
      takeProfit: h.takeProfit ? String(h.takeProfit) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(editData.quantity),
          averagePrice: Number(editData.averagePrice),
          horizon: editData.horizon,
          stopLoss: editData.stopLoss ? Number(editData.stopLoss) : null,
          takeProfit: editData.takeProfit ? Number(editData.takeProfit) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update holding");
      }
      setEditingId(null);
      setLoading(true);
      fetchHoldings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleAIReview = async () => {
    if (holdings.length === 0) return;
    setReviewing(true);
    setError(null);
    setAiReview(null);

    try {
      const payload = holdings.map((h) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        averagePrice: h.averagePrice,
        currentPrice: h.currentPrice,
        horizon: h.horizon,
        stopLoss: h.stopLoss ?? null,
        takeProfit: h.takeProfit ?? null,
        pnlPercent:
          h.currentPrice && h.averagePrice > 0
            ? ((h.currentPrice - h.averagePrice) / h.averagePrice) * 100
            : 0,
      }));

      const res = await fetch("/api/portfolio/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: payload }),
      });

      if (!res.ok) throw new Error("AI review failed");
      const data = await res.json();
      const review = data.review;
      setAiReview(review);
      setAiReviewAge(new Date().toISOString());
      setBgResearchSymbols(data.backgroundResearchSymbols || []);

      try {
        await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: "PORTFOLIO",
            reportType: "portfolio_review",
            result: review,
            model: "sonnet",
          }),
        });
      } catch {
        // best-effort save
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI review");
    } finally {
      setReviewing(false);
    }
  };

  const getAIAction = (symbol: string): AIHoldingReview | undefined => {
    return aiReview?.holdings.find(
      (h) => h.symbol.toUpperCase() === symbol.toUpperCase(),
    );
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
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
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
            Danh mục đầu tư
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Theo dõi danh mục và nhận khuyến nghị AI
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAIReview}
            disabled={reviewing || holdings.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {reviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : aiReviewAge ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {reviewing
              ? "Đang phân tích..."
              : aiReviewAge
                ? "Re-review"
                : "AI Review"}
          </button>
          {aiReviewAge && !reviewing && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
              <Clock className="h-3 w-3" />
              {formatAge(aiReviewAge)}
            </span>
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

      {/* Deep Research Alert */}
      {staleResearchSymbols.length > 0 &&
        !dismissedResearchAlert &&
        holdings.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {staleResearchSymbols.length} cổ phiếu chưa có dữ liệu nghiên
                  cứu hoặc đã cũ (&gt;7 ngày)
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Chạy Deep Research trước khi AI Review để kết quả chính xác
                  hơn.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {staleResearchSymbols.map((sym) => (
                    <Link
                      key={sym}
                      href={`/stocks/${sym}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                    >
                      <BookOpen className="h-3 w-3" />
                      {sym}
                    </Link>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissedResearchAlert(true)}
                className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-400 hover:text-amber-600 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      {/* Add Holding Form */}
      {showAddForm && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Thêm cổ phiếu
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
                Số lượng
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
                Giá TB (VND)
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
                Kỳ hạn
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
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Stop Loss
                <input
                  type="number"
                  value={formStopLoss}
                  onChange={(e) => setFormStopLoss(e.target.value)}
                  placeholder="80000"
                  min="0"
                  className="mt-1 block w-28 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Take Profit
                <input
                  type="number"
                  value={formTakeProfit}
                  onChange={(e) => setFormTakeProfit(e.target.value)}
                  placeholder="100000"
                  min="0"
                  className="mt-1 block w-28 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
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

      {/* Portfolio Summary */}
      {holdings.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Tổng giá trị"
            value={`${formatVND(Math.round(totalValue))} VND`}
          />
          <SummaryCard
            label="Lãi/Lỗ"
            value={`${totalPnl >= 0 ? "+" : ""}${formatVND(Math.round(totalPnl))} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}%)`}
            positive={totalPnl >= 0}
          />
          <SummaryCard label="Tỷ lệ thắng" value={`${winRate}%`} />
          <SummaryCard label="Cổ phiếu" value={`${holdings.length} mã`} />
        </div>
      )}

      {/* AI Review Result */}
      {reviewing && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-5 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-blue-600 dark:text-blue-400">
            AI đang phân tích danh mục của bạn...
          </span>
        </div>
      )}

      {aiReview && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              AI Portfolio Review
            </h2>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {aiReview.portfolio_summary}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {aiReview.holdings.map((h) => (
              <div
                key={h.symbol}
                className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Link
                    href={`/stocks/${h.symbol}`}
                    className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:underline"
                  >
                    {h.symbol}
                  </Link>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_COLORS[h.action] || ACTION_COLORS.HOLD}`}
                  >
                    {h.action === "ADD_MORE"
                      ? "MUA THÊM"
                      : h.action === "SELL"
                        ? "BÁN"
                        : "GIỮ"}
                  </span>
                  {h.urgency === "high" && (
                    <span className="text-xs text-red-500 font-medium">
                      Khẩn cấp
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {h.reasoning}
                </p>
                {(h.suggested_stop_loss || h.suggested_take_profit) && (
                  <div className="flex gap-3 mt-2">
                    {h.suggested_stop_loss && (
                      <span className="text-[10px] font-mono bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                        SL: {formatVND(h.suggested_stop_loss)}
                      </span>
                    )}
                    {h.suggested_take_profit && (
                      <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                        TP: {formatVND(h.suggested_take_profit)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {bgResearchSymbols.length > 0 && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Đang chạy Deep Research cho {bgResearchSymbols.length} mã (
                {bgResearchSymbols.join(", ")}) — review tiếp theo sẽ chính xác
                hơn.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Holdings Table */}
      {holdings.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Cổ phiếu
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    SL
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Giá TB
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Giá hiện tại
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Lãi/Lỗ
                  </th>
                  <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Kỳ hạn
                  </th>
                  <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    SL / TP
                  </th>
                  <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                    Cổ tức
                  </th>
                  {aiReview && (
                    <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                      AI
                    </th>
                  )}
                  <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-3 py-3 w-20" />
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
                  const isEditing = editingId === h.id;
                  const aiAction = getAIAction(h.symbol);

                  return (
                    <tr
                      key={h.id}
                      className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/stocks/${h.symbol}`}
                          className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                        >
                          {h.symbol}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editData.quantity}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                quantity: e.target.value,
                              })
                            }
                            min="1"
                            className="w-20 px-2 py-1 text-sm text-right rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          />
                        ) : (
                          <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                            {formatVND(h.quantity)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editData.averagePrice}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                averagePrice: e.target.value,
                              })
                            }
                            min="1"
                            className="w-24 px-2 py-1 text-sm text-right rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          />
                        ) : (
                          <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                            {formatVND(h.averagePrice)}
                          </span>
                        )}
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
                        {isEditing ? (
                          <select
                            value={editData.horizon}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                horizon: e.target.value,
                              })
                            }
                            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          >
                            {HORIZONS.map((ho) => (
                              <option key={ho.value} value={ho.value}>
                                {ho.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${HORIZON_COLORS[h.horizon] || ""}`}
                          >
                            {HORIZON_LABELS[h.horizon] || h.horizon}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={editData.stopLoss}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  stopLoss: e.target.value,
                                })
                              }
                              placeholder="SL"
                              className="w-20 px-2 py-1 text-xs text-right rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            />
                            <input
                              type="number"
                              value={editData.takeProfit}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  takeProfit: e.target.value,
                                })
                              }
                              placeholder="TP"
                              className="w-20 px-2 py-1 text-xs text-right rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                        ) : (
                          <div className="text-xs font-mono space-y-0.5">
                            {h.stopLoss ? (
                              <div
                                className={
                                  h.currentPrice &&
                                  h.currentPrice <= h.stopLoss * 1.03
                                    ? "text-red-500 font-medium"
                                    : "text-zinc-400"
                                }
                              >
                                SL: {formatVND(h.stopLoss)}
                              </div>
                            ) : null}
                            {h.takeProfit ? (
                              <div
                                className={
                                  h.currentPrice &&
                                  h.currentPrice >= h.takeProfit * 0.97
                                    ? "text-emerald-600 font-medium"
                                    : "text-zinc-400"
                                }
                              >
                                TP: {formatVND(h.takeProfit)}
                              </div>
                            ) : null}
                            {!h.stopLoss && !h.takeProfit && (
                              <span className="text-zinc-300 dark:text-zinc-600">
                                -
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {h.dividendYield ? (
                          <span className="text-sm font-mono text-emerald-600">
                            {(h.dividendYield * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-300 dark:text-zinc-600">
                            -
                          </span>
                        )}
                      </td>
                      {aiReview && (
                        <td className="px-5 py-3 text-center">
                          {aiAction && (
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_COLORS[aiAction.action] || ACTION_COLORS.HOLD}`}
                              title={aiAction.reasoning}
                            >
                              {aiAction.action === "ADD_MORE"
                                ? "MUA THÊM"
                                : aiAction.action === "SELL"
                                  ? "BÁN"
                                  : "GIỮ"}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(h.id)}
                                disabled={saving}
                                className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors"
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/stocks/${h.symbol}`}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition-colors"
                                title="Phân tích chi tiết"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => startEdit(h)}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(h.id, h.symbol)}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
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
          <Plus className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Danh mục trống</p>
          <p className="text-xs mt-1">Thêm cổ phiếu để bắt đầu theo dõi</p>
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

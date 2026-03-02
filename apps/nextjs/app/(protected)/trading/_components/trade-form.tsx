"use client";

import {
  AlertCircle,
  ArrowDownUp,
  Check,
  KeyRound,
  Loader2,
  ShoppingCart,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

interface TradeFormProps {
  initialSymbol?: string;
  initialSide?: "BUY" | "SELL";
  onOrderPlaced?: () => void;
}

const ORDER_TYPES = ["LO", "MP", "ATO", "ATC"] as const;

export function TradeForm({
  initialSymbol = "",
  initialSide = "BUY",
  onOrderPlaced,
}: TradeFormProps) {
  const [open, setOpen] = useState(!!initialSymbol);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [side, setSide] = useState<"BUY" | "SELL">(initialSide);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] =
    useState<(typeof ORDER_TYPES)[number]>("LO");

  const [tradingToken, setTradingToken] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleVerifyOtp = useCallback(async () => {
    if (!otpValue.trim()) return;
    setVerifyingOtp(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/trading-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: otpValue.trim(),
          otpType: "smart_otp",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify OTP");
      }
      const token = data.tradingToken || data.trading_token || data.token;
      if (!token) {
        throw new Error("No trading token received");
      }
      setTradingToken(token);
      setOtpValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify OTP");
    } finally {
      setVerifyingOtp(false);
    }
  }, [otpValue]);

  const handlePlaceOrder = useCallback(async () => {
    if (!symbol.trim() || !quantity || !tradingToken) return;
    setPlacing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/trading/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          side,
          quantity: Number(quantity),
          price: price ? Number(price) : undefined,
          orderType,
          tradingToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order");
      }
      setSuccess(
        `${side === "BUY" ? "Mua" : "Bán"} ${Number(quantity).toLocaleString("vi-VN")} ${symbol.toUpperCase()} thành công!`,
      );
      setQuantity("");
      setPrice("");
      onOrderPlaced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }, [symbol, side, quantity, price, orderType, tradingToken, onOrderPlaced]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        Đặt lệnh
      </button>
    );
  }

  const canTrade = !!tradingToken;
  const needsPrice = orderType === "LO";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Đặt lệnh giao dịch
          </h2>
          {canTrade && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" />
              Đã xác thực
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex items-center gap-2 mb-4">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400 flex-1">
            {error}
          </span>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-2 mb-4">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-sm text-emerald-600 dark:text-emerald-400 flex-1">
            {success}
          </span>
          <button type="button" onClick={() => setSuccess(null)}>
            <X className="h-3.5 w-3.5 text-emerald-400" />
          </button>
        </div>
      )}

      {/* Smart OTP Authentication */}
      {!canTrade && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Xác thực giao dịch
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            Mở app DNSE, lấy mã Smart OTP và nhập bên dưới (hiệu lực 8 giờ)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={otpValue}
              onChange={(e) =>
                setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              className="w-32 px-3 py-2 text-sm font-mono text-center tracking-widest rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={verifyingOtp || otpValue.length < 6}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {verifyingOtp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {verifyingOtp ? "Đang xác thực..." : "Xác nhận"}
            </button>
          </div>
        </div>
      )}

      {/* Order Form */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-end">
        {/* Symbol */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Mã CK
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="VCB"
              maxLength={10}
              className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
          </label>
        </div>

        {/* Side */}
        <div>
          <span className="block text-xs text-zinc-500 mb-1">Lệnh</span>
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setSide("BUY")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                side === "BUY"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Mua
            </button>
            <button
              type="button"
              onClick={() => setSide("SELL")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                side === "SELL"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Bán
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Khối lượng
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              min={100}
              step={100}
              className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
          </label>
        </div>

        {/* Order Type */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Loại lệnh
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as typeof orderType)}
              className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              {ORDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Price */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Giá {!needsPrice && "(bỏ qua)"}
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={needsPrice ? "88500" : "MP"}
              disabled={!needsPrice}
              min={0}
              step={100}
              className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>
        </div>

        {/* Submit */}
        <div>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={
              placing ||
              !canTrade ||
              !symbol.trim() ||
              !quantity ||
              (needsPrice && !price)
            }
            className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              side === "BUY"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {placing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" />
            )}
            {placing
              ? "Đang đặt..."
              : `${side === "BUY" ? "Mua" : "Bán"} ${symbol || "..."}`}
          </button>
        </div>
      </div>
    </div>
  );
}

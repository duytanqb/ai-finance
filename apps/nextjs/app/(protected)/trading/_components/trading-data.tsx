"use client";

import { AlertCircle, KeyRound, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AccountCard } from "./account-card";
import { HoldingsTable } from "./holdings-table";
import { OrdersTable } from "./orders-table";
import { TradeForm } from "./trade-form";

interface TradingState {
  account: Record<string, unknown> | null;
  balance: Record<string, unknown> | null;
  holdings: Record<string, unknown>[] | null;
  orders: Record<string, unknown>[] | null;
}

export function TradingData() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "";
  const initialSide = (searchParams.get("side") === "SELL" ? "SELL" : "BUY") as
    | "BUY"
    | "SELL";

  const [data, setData] = useState<TradingState>({
    account: null,
    balance: null,
    holdings: null,
    orders: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [accountRes, balanceRes, holdingsRes, ordersRes] =
        await Promise.allSettled([
          fetch("/api/trading/account"),
          fetch("/api/trading/balance"),
          fetch("/api/trading/holdings"),
          fetch("/api/trading/orders"),
        ]);

      const accountOk =
        accountRes.status === "fulfilled" && accountRes.value.ok;
      const firstRes =
        accountRes.status === "fulfilled" ? accountRes.value : null;

      if (firstRes && firstRes.status === 404) {
        setNotConfigured(true);
        return;
      }

      if (!accountOk && firstRes) {
        const body = await firstRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ||
            `DNSE API error ${firstRes.status}`,
        );
      }

      const account = accountOk
        ? await (accountRes as PromiseFulfilledResult<Response>).value.json()
        : null;

      const balance =
        balanceRes.status === "fulfilled" && balanceRes.value.ok
          ? await balanceRes.value.json()
          : null;

      const holdingsRaw =
        holdingsRes.status === "fulfilled" && holdingsRes.value.ok
          ? await holdingsRes.value.json()
          : null;

      const ordersRaw =
        ordersRes.status === "fulfilled" && ordersRes.value.ok
          ? await ordersRes.value.json()
          : null;

      setData({
        account,
        balance,
        holdings: Array.isArray(holdingsRaw)
          ? holdingsRaw
          : holdingsRaw?.holdings || holdingsRaw?.data || null,
        orders: Array.isArray(ordersRaw)
          ? ordersRaw
          : ordersRaw?.orders || ordersRaw?.data || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi kết nối DNSE");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center">
        <KeyRound className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Chưa kết nối DNSE
        </p>
        <p className="text-xs text-zinc-500 mt-1 mb-4">
          Cấu hình API Key DNSE để xem tài khoản và danh mục thực
        </p>
        <Link
          href="/settings/trading"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Cấu hình API Key
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400 flex-1">
            {error}
          </span>
        </div>
      )}

      <TradeForm
        initialSymbol={initialSymbol}
        initialSide={initialSide}
        onOrderPlaced={() => fetchData(true)}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <AccountCard
        account={data.account}
        balance={data.balance}
        holdings={data.holdings}
      />
      <HoldingsTable holdings={data.holdings} />
      <OrdersTable orders={data.orders} />
    </div>
  );
}

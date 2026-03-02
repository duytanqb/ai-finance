"use client";

import { ArrowDownRight, ArrowUpRight, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface PortfolioHolding {
  symbol: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

interface HoldingsTableProps {
  holdings: Record<string, unknown>[] | null;
}

function formatVND(value: number): string {
  return value.toLocaleString("vi-VN");
}

function getNum(
  obj: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number") return val;
  }
  return null;
}

function getStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val) return val;
  }
  return "";
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [portfolioMap, setPortfolioMap] = useState<
    Record<string, PortfolioHolding>
  >({});

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const res = await fetch("/api/portfolio");
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, PortfolioHolding> = {};
          for (const h of data.holdings ?? []) {
            map[h.symbol?.toUpperCase()] = h;
          }
          setPortfolioMap(map);
        }
      } catch {
        // silent
      }
    }
    if (holdings && holdings.length > 0) fetchPortfolio();
  }, [holdings]);

  if (!holdings || holdings.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 text-center text-zinc-400">
        <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Chưa có cổ phiếu nào</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Danh mục cổ phiếu ({holdings.length} mã)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Mã CK
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                SL
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Giá TB
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Giá TT
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Lãi/Lỗ
              </th>
              <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                SL / TP
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const symbol = getStr(
                h,
                "symbol",
                "stockSymbol",
                "ticker",
                "stockCode",
              );
              const qty = getNum(
                h,
                "quantity",
                "totalQuantity",
                "holdingQuantity",
                "qty",
                "volume",
              );
              const avgPrice = getNum(
                h,
                "avgPrice",
                "averagePrice",
                "costPrice",
                "avgCost",
              );
              const marketPrice = getNum(
                h,
                "marketPrice",
                "currentPrice",
                "lastPrice",
                "matchPrice",
              );
              const pnl = getNum(
                h,
                "pnl",
                "profitLoss",
                "unrealizedPnL",
                "gainLoss",
              );
              const pnlPct = getNum(
                h,
                "pnlPercent",
                "pnlPct",
                "profitLossPercent",
                "gainLossPercent",
              );

              const computedPnl =
                pnl ??
                (qty && avgPrice && marketPrice
                  ? (marketPrice - avgPrice) * qty
                  : null);
              const computedPnlPct =
                pnlPct ??
                (avgPrice && marketPrice && avgPrice > 0
                  ? ((marketPrice - avgPrice) / avgPrice) * 100
                  : null);
              const positive = computedPnl != null ? computedPnl >= 0 : null;

              const portfolio = symbol
                ? portfolioMap[symbol.toUpperCase()]
                : undefined;
              const sl = portfolio?.stopLoss;
              const tp = portfolio?.takeProfit;
              const nearSl =
                sl && marketPrice ? marketPrice <= sl * 1.03 : false;
              const nearTp =
                tp && marketPrice ? marketPrice >= tp * 0.97 : false;

              return (
                <tr
                  key={symbol || i}
                  className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-5 py-3">
                    {symbol ? (
                      <Link
                        href={`/stocks/${symbol}`}
                        className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                      >
                        {symbol}
                      </Link>
                    ) : (
                      <span className="text-sm text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {qty != null ? formatVND(qty) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {avgPrice != null ? formatVND(avgPrice) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-900 dark:text-zinc-100">
                    {marketPrice != null ? formatVND(marketPrice) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {computedPnl != null && positive != null ? (
                      <div className="flex items-center justify-end gap-1">
                        {positive ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <span
                          className={`text-sm font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {computedPnlPct != null
                            ? `${positive ? "+" : ""}${computedPnlPct.toFixed(1)}%`
                            : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400">-</span>
                    )}
                    {computedPnl != null && (
                      <div
                        className={`text-xs font-mono ${positive ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {positive ? "+" : ""}
                        {formatVND(Math.round(computedPnl))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="text-xs font-mono space-y-0.5">
                      {sl ? (
                        <div
                          className={
                            nearSl
                              ? "text-red-500 font-medium"
                              : "text-zinc-400"
                          }
                        >
                          SL: {formatVND(sl)}
                        </div>
                      ) : null}
                      {tp ? (
                        <div
                          className={
                            nearTp
                              ? "text-emerald-600 font-medium"
                              : "text-zinc-400"
                          }
                        >
                          TP: {formatVND(tp)}
                        </div>
                      ) : null}
                      {!sl && !tp && (
                        <span className="text-zinc-300 dark:text-zinc-600">
                          -
                        </span>
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
  );
}

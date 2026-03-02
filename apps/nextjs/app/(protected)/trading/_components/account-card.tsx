"use client";

import { Banknote, PiggyBank, TrendingUp, Wallet } from "lucide-react";

interface AccountCardProps {
  account: Record<string, unknown> | null;
  balance: Record<string, unknown> | null;
  holdings: Record<string, unknown>[] | null;
}

function formatVND(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value));
}

function findNum(
  obj: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number") return val;
    if (typeof val === "string" && val && !Number.isNaN(Number(val)))
      return Number(val);
  }
  return null;
}

function findStr(
  obj: Record<string, unknown> | null,
  ...keys: string[]
): string {
  if (!obj) return "";
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val) return val;
    if (typeof val === "number") return String(val);
  }
  return "";
}

function computeHoldingsTotal(
  holdings: Record<string, unknown>[] | null,
): number {
  if (!holdings || holdings.length === 0) return 0;
  let total = 0;
  for (const h of holdings) {
    const marketValue = findNum(h, "marketValue", "totalValue", "currentValue");
    if (marketValue != null) {
      total += marketValue;
      continue;
    }
    const qty = findNum(
      h,
      "quantity",
      "totalQuantity",
      "holdingQuantity",
      "qty",
      "volume",
    );
    const price = findNum(
      h,
      "marketPrice",
      "currentPrice",
      "lastPrice",
      "matchPrice",
    );
    if (qty != null && price != null) {
      total += qty * price;
    }
  }
  return total;
}

export function AccountCard({ account, balance, holdings }: AccountCardProps) {
  const accountName = findStr(
    account,
    "name",
    "accountName",
    "fullName",
    "customerName",
  );
  const custodyCode = findStr(account, "custodyCode");

  // Balance is nested: { stock: { totalCash, availableCash, ... }, derivative: { ... } }
  const stockBalance = (balance?.stock ?? null) as Record<
    string,
    unknown
  > | null;

  const totalCash = findNum(stockBalance, "totalCash");
  const availableCash = findNum(stockBalance, "availableCash");
  const withdrawableCash = findNum(stockBalance, "withdrawableCash");
  const depositInterest = findNum(stockBalance, "depositInterest");
  const totalDebt = findNum(stockBalance, "totalDebt");
  const cashDividend = findNum(stockBalance, "cashDividendReceiving");

  const stockValue = computeHoldingsTotal(holdings);
  const totalAsset = (totalCash ?? 0) + stockValue;

  return (
    <div className="space-y-4">
      {/* Account info bar */}
      {(accountName || custodyCode) && (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {accountName}
          </span>
          {custodyCode && (
            <span className="font-mono text-xs text-zinc-500">
              {custodyCode}
            </span>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          label="Tổng tài sản"
          value={totalAsset}
          iconColor="text-blue-600"
        />
        <SummaryCard
          icon={<Banknote className="h-5 w-5" />}
          label="Tiền mặt"
          value={totalCash}
          iconColor="text-emerald-600"
          sub={
            availableCash != null
              ? `Khả dụng: ${formatVND(availableCash)}`
              : undefined
          }
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Giá trị cổ phiếu"
          value={stockValue > 0 ? stockValue : 0}
          iconColor="text-amber-600"
        />
        <SummaryCard
          icon={<PiggyBank className="h-5 w-5" />}
          label="Có thể rút"
          value={withdrawableCash}
          iconColor="text-purple-600"
        />
      </div>

      {/* Extra details row */}
      {(depositInterest != null ||
        totalDebt != null ||
        cashDividend != null) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-1">
          {depositInterest != null && depositInterest > 0 && (
            <DetailItem label="Lãi tiền gửi" value={depositInterest} />
          )}
          {totalDebt != null && totalDebt > 0 && (
            <DetailItem label="Dư nợ" value={totalDebt} negative />
          )}
          {cashDividend != null && cashDividend > 0 && (
            <DetailItem label="Cổ tức chờ nhận" value={cashDividend} />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  iconColor,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  iconColor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={iconColor}>{icon}</span>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
        {value != null ? `${formatVND(value)}` : "-"}
      </p>
      {value != null && <p className="text-xs text-zinc-400 mt-0.5">VND</p>}
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function DetailItem({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <span className="text-xs text-zinc-500">
      {label}:{" "}
      <span
        className={`font-mono font-medium ${negative ? "text-red-500" : "text-zinc-700 dark:text-zinc-300"}`}
      >
        {formatVND(value)}
      </span>
    </span>
  );
}

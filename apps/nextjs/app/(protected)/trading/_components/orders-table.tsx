"use client";

import { ClipboardList } from "lucide-react";

interface OrdersTableProps {
  orders: Record<string, unknown>[] | null;
}

function getStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val) return val;
  }
  return "";
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

function formatVND(value: number): string {
  return value.toLocaleString("vi-VN");
}

const SIDE_LABELS: Record<string, { text: string; className: string }> = {
  BUY: {
    text: "Mua",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  SELL: {
    text: "Bán",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  NB: {
    text: "Mua",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  NS: {
    text: "Bán",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  B: {
    text: "Mua",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  S: {
    text: "Bán",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  FILLED: {
    text: "Khớp",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  PARTIAL: {
    text: "Khớp 1 phần",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  PENDING: {
    text: "Chờ",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  CANCELLED: {
    text: "Đã hủy",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  },
  REJECTED: {
    text: "Từ chối",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  NEW: {
    text: "Mới",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

function formatOrderTime(obj: Record<string, unknown>): string {
  const raw = getStr(
    obj,
    "time",
    "orderTime",
    "createdAt",
    "createTime",
    "inputTime",
  );
  if (!raw) return "-";
  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

export function OrdersTable({ orders }: OrdersTableProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 text-center text-zinc-400">
        <ClipboardList className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Chưa có lệnh nào</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Lệnh gần đây ({orders.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Thời gian
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Mã CK
              </th>
              <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Loại
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                KL
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Giá
              </th>
              <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Trạng thái
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const orderId = String(
                order.orderId ?? order.orderNo ?? order.id ?? "",
              );
              const symbol = getStr(
                order,
                "symbol",
                "stockSymbol",
                "ticker",
                "stockCode",
              );
              const side = getStr(
                order,
                "side",
                "orderSide",
                "buySell",
                "tradeType",
              ).toUpperCase();
              const qty = getNum(
                order,
                "quantity",
                "orderQuantity",
                "qty",
                "volume",
              );
              const price = getNum(order, "price", "orderPrice", "matchPrice");
              const status = getStr(
                order,
                "status",
                "orderStatus",
                "state",
              ).toUpperCase();
              const time = formatOrderTime(order);

              const sideInfo = SIDE_LABELS[side] || {
                text: side || "-",
                className: "bg-zinc-100 text-zinc-600",
              };
              const statusInfo = STATUS_LABELS[status] || {
                text: status || "-",
                className:
                  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
              };

              return (
                <tr
                  key={orderId || `${symbol}-${time}`}
                  className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-zinc-500 font-mono">
                    {time}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {symbol || "-"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${sideInfo.className}`}
                    >
                      {sideInfo.text}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {qty != null ? formatVND(qty) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-900 dark:text-zinc-100">
                    {price != null ? formatVND(price) : "-"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}
                    >
                      {statusInfo.text}
                    </span>
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

"use client";

import { Bell, TrendingDown, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface PriceAlertItem {
  id: string;
  symbol: string;
  alertType: string;
  triggerPrice: number;
  currentPrice: number;
  message: string;
  read: boolean;
  createdAt: string;
}

export function AlertBell() {
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const markAsRead = async (ids: string[]) => {
    try {
      await fetch("/api/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setAlerts((prev) =>
        prev.map((a) => (ids.includes(a.id) ? { ...a, read: true } : a)),
      );
    } catch {
      // silent
    }
  };

  const markAllRead = () => {
    const unreadIds = alerts.filter((a) => !a.read).map((a) => a.id);
    if (unreadIds.length > 0) markAsRead(unreadIds);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchAlerts();
        }}
        className="relative p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
      >
        <Bell className="h-4 w-4 text-zinc-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Cảnh báo giá
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  Đã đọc tất cả
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">
                Chưa có cảnh báo nào
              </div>
            ) : (
              alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/stocks/${alert.symbol}`}
                  onClick={() => {
                    if (!alert.read) markAsRead([alert.id]);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-b border-zinc-50 dark:border-zinc-900 last:border-0 ${
                    !alert.read ? "bg-amber-50/50 dark:bg-amber-900/5" : ""
                  }`}
                >
                  <div className="mt-0.5">
                    {alert.alertType === "stop_loss" ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {alert.symbol}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          alert.alertType === "stop_loss"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}
                      >
                        {alert.alertType === "stop_loss" ? "SL" : "TP"}
                      </span>
                      {!alert.read && (
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {formatAge(alert.createdAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

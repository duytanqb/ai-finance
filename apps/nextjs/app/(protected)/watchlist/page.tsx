"use client";

import { Eye, Plus, Trash2 } from "lucide-react";

const MOCK_WATCHLIST = [
  {
    symbol: "ACB",
    name: "Asia Commercial Bank",
    price: "24,500",
    change: "+1.8%",
    target: "22,000",
    note: "Wait for pullback",
  },
  {
    symbol: "VRE",
    name: "Vincom Retail",
    price: "28,100",
    change: "-0.4%",
    target: "25,000",
    note: "Near support zone",
  },
  {
    symbol: "PNJ",
    name: "Phu Nhuan Jewelry",
    price: "98,200",
    change: "+0.6%",
    target: "90,000",
    note: "Strong Q4 earnings expected",
  },
];

export default function WatchlistPage() {
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
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Stock
        </button>
      </div>

      {MOCK_WATCHLIST.length > 0 ? (
        <div className="space-y-3">
          {MOCK_WATCHLIST.map((stock) => (
            <div
              key={stock.symbol}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {stock.symbol}
                  </div>
                  <div className="text-xs text-zinc-500">{stock.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                    {stock.price}
                  </div>
                  <div
                    className={`text-xs font-medium ${stock.change.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {stock.change}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Target</div>
                  <div className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                    {stock.target}
                  </div>
                </div>
                <div className="text-right max-w-[200px]">
                  <div className="text-xs text-zinc-500">Note</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                    {stock.note}
                  </div>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
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

"use client";

import { LineChart, Search, Sparkles } from "lucide-react";
import { useState } from "react";

const POPULAR_STOCKS = [
  {
    symbol: "VCB",
    name: "Vietcombank",
    price: "88,500",
    change: "+1.2%",
    sector: "Banking",
  },
  {
    symbol: "FPT",
    name: "FPT Corporation",
    price: "132,800",
    change: "+0.8%",
    sector: "Technology",
  },
  {
    symbol: "VNM",
    name: "Vinamilk",
    price: "72,300",
    change: "-0.5%",
    sector: "Consumer",
  },
  {
    symbol: "HPG",
    name: "Hoa Phat Group",
    price: "26,200",
    change: "+2.1%",
    sector: "Steel",
  },
  {
    symbol: "MWG",
    name: "Mobile World",
    price: "52,100",
    change: "+0.3%",
    sector: "Retail",
  },
  {
    symbol: "TCB",
    name: "Techcombank",
    price: "55,400",
    change: "-0.7%",
    sector: "Banking",
  },
  {
    symbol: "VHM",
    name: "Vinhomes",
    price: "38,900",
    change: "+1.5%",
    sector: "Real Estate",
  },
  {
    symbol: "MSN",
    name: "Masan Group",
    price: "78,600",
    change: "+0.4%",
    sector: "Conglomerate",
  },
];

export default function StocksPage() {
  const [search, setSearch] = useState("");

  const filtered = POPULAR_STOCKS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Stocks
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Search and analyze any Vietnam stock
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by symbol or company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
      </div>

      {/* Stock List */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Symbol
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Company
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Sector
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Price (VND)
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Change
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((stock) => (
              <tr
                key={stock.symbol}
                className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <td className="px-5 py-3">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {stock.symbol}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {stock.name}
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {stock.sector}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-sm font-mono text-zinc-900 dark:text-zinc-100">
                  {stock.price}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={`text-sm font-medium ${stock.change.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {stock.change}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
                  >
                    <Sparkles className="h-3 w-3" />
                    Analyze
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <LineChart className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No stocks found for "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

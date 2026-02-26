"use client";

import { LineChart, Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface StockItem {
  symbol: string;
  organ_name: string;
  exchange: string;
  [key: string]: unknown;
}

const POPULAR_SYMBOLS = [
  "VCB",
  "FPT",
  "VNM",
  "HPG",
  "MWG",
  "TCB",
  "VHM",
  "MSN",
  "ACB",
  "VIC",
];

export default function StocksPage() {
  const [search, setSearch] = useState("");
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPopularStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      const all: StockItem[] = json.data || [];
      const popular = POPULAR_SYMBOLS.map((sym) =>
        all.find((s) => s.symbol === sym),
      ).filter(Boolean) as StockItem[];
      setStocks(popular.length > 0 ? popular : all.slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stocks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPopularStocks();
  }, [fetchPopularStocks]);

  const searchStocks = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        fetchPopularStocks();
        return;
      }
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setStocks(json.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setSearching(false);
      }
    },
    [fetchPopularStocks],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchStocks(value);
    }, 300);
  };

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
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm">Loading stocks...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 text-center">
          <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
          <button
            type="button"
            onClick={fetchPopularStocks}
            className="mt-2 text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Stock List */}
      {!loading && !error && (
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
                  Exchange
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/stocks/${stock.symbol}`}
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:underline"
                    >
                      {stock.symbol}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <Link href={`/stocks/${stock.symbol}`}>
                      {stock.organ_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {stock.exchange}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/stocks/${stock.symbol}`}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition-opacity"
                      >
                        <Sparkles className="h-3 w-3" />
                        Analyze
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {stocks.length === 0 && !searching && (
            <div className="text-center py-12 text-zinc-400">
              <LineChart className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {search
                  ? `No stocks found for "${search}"`
                  : "No stocks available"}
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && !search && (
        <p className="text-xs text-zinc-400 text-center">
          Showing popular stocks. Type to search all HOSE, HNX, UPCOM symbols.
        </p>
      )}
    </div>
  );
}

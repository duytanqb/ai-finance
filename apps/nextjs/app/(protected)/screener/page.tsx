"use client";

import { Filter, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

interface ScreenResult {
  symbol: string;
  organ_name?: string;
  exchange?: string;
  pe?: number | null;
  pb?: number | null;
  roe?: number | null;
  market_cap?: number | null;
  dividend_yield?: number | null;
}

interface Filters {
  exchange: string;
  min_pe: string;
  max_pe: string;
  min_pb: string;
  max_pb: string;
  min_roe: string;
  min_market_cap: string;
  min_dividend_yield: string;
  max_price: string;
}

const EMPTY_FILTERS: Filters = {
  exchange: "",
  min_pe: "",
  max_pe: "",
  min_pb: "",
  max_pb: "",
  min_roe: "",
  min_market_cap: "",
  min_dividend_yield: "",
  max_price: "",
};

export default function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleScreen = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (filters.exchange.trim())
        params.set("exchange", filters.exchange.trim());
      if (filters.min_pe.trim()) params.set("min_pe", filters.min_pe.trim());
      if (filters.max_pe.trim()) params.set("max_pe", filters.max_pe.trim());
      if (filters.min_pb.trim()) params.set("min_pb", filters.min_pb.trim());
      if (filters.max_pb.trim()) params.set("max_pb", filters.max_pb.trim());
      if (filters.min_roe.trim()) params.set("min_roe", filters.min_roe.trim());
      if (filters.min_market_cap.trim())
        params.set("min_market_cap", filters.min_market_cap.trim());
      if (filters.min_dividend_yield.trim())
        params.set("min_dividend_yield", filters.min_dividend_yield.trim());
      if (filters.max_price.trim())
        params.set("max_price", filters.max_price.trim());

      const query = params.toString();
      const res = await fetch(`/api/stocks/screen${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      setResults(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screening failed");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setResults([]);
    setSearched(false);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Screener
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Filter stocks by financial criteria
        </p>
      </div>

      {/* Manual Filters */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Filters
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FilterField
            label="Exchange"
            placeholder="HOSE, HNX, UPCOM"
            value={filters.exchange}
            onChange={(v) => updateFilter("exchange", v)}
          />
          <FilterField
            label="Min P/E"
            placeholder="e.g. 5"
            value={filters.min_pe}
            onChange={(v) => updateFilter("min_pe", v)}
            type="number"
          />
          <FilterField
            label="Max P/E"
            placeholder="e.g. 15"
            value={filters.max_pe}
            onChange={(v) => updateFilter("max_pe", v)}
            type="number"
          />
          <FilterField
            label="Min P/B"
            placeholder="e.g. 0.5"
            value={filters.min_pb}
            onChange={(v) => updateFilter("min_pb", v)}
            type="number"
          />
          <FilterField
            label="Max P/B"
            placeholder="e.g. 3"
            value={filters.max_pb}
            onChange={(v) => updateFilter("max_pb", v)}
            type="number"
          />
          <FilterField
            label="Min ROE"
            placeholder="e.g. 0.15 for 15%"
            value={filters.min_roe}
            onChange={(v) => updateFilter("min_roe", v)}
            type="number"
          />
          <FilterField
            label="Min Market Cap (B VND)"
            placeholder="e.g. 10000"
            value={filters.min_market_cap}
            onChange={(v) => updateFilter("min_market_cap", v)}
            type="number"
          />
          <FilterField
            label="Min Dividend Yield"
            placeholder="e.g. 0.03 for 3%"
            value={filters.min_dividend_yield}
            onChange={(v) => updateFilter("min_dividend_yield", v)}
            type="number"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleScreen}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {loading ? "Screening..." : "Screen Stocks"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 text-center">
          <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
          <button
            type="button"
            onClick={handleScreen}
            className="mt-2 text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {searched && !loading && !error && results.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm text-zinc-500">
              {results.length} stock{results.length !== 1 ? "s" : ""} found
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  Symbol
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  Company
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  P/E
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  P/B
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  ROE
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  Div. Yield
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">
                  Market Cap
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((stock) => (
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
                    {stock.organ_name || "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {stock.pe != null ? stock.pe.toFixed(1) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {stock.pb != null ? stock.pb.toFixed(2) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {stock.roe != null
                      ? `${(stock.roe * 100).toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {stock.dividend_yield != null
                      ? `${(stock.dividend_yield * 100).toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    {stock.market_cap != null
                      ? stock.market_cap >= 1e12
                        ? `${(stock.market_cap / 1e12).toFixed(1)}T`
                        : `${(stock.market_cap / 1e9).toFixed(0)}B`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && !error && results.length === 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No stocks match your criteria</p>
          <p className="text-xs mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Initial state */}
      {!searched && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            Set filters and click "Screen Stocks" to find matches
          </p>
        </div>
      )}
    </div>
  );
}

function FilterField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
      </label>
    </div>
  );
}

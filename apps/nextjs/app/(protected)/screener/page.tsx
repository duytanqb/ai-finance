"use client";

import { Filter, Search, Sparkles } from "lucide-react";

export default function ScreenerPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Screener
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Filter stocks by criteria or describe what you want with AI
        </p>
      </div>

      {/* AI Screen */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Screen with AI
          </h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder='E.g. "Banking stocks with PE < 10 and ROE > 15%"'
            className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity"
          >
            Search
          </button>
        </div>
      </div>

      {/* Manual Filters */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Manual Filters
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Exchange" placeholder="HOSE, HNX, UPCOM" />
          <FilterField label="Max P/E" placeholder="e.g. 15" />
          <FilterField label="Min ROE (%)" placeholder="e.g. 15" />
          <FilterField label="Sector" placeholder="Banking, Tech..." />
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Results placeholder */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
        <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          Set filters or describe criteria to find stocks
        </p>
      </div>
    </div>
  );
}

function FilterField({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
        <input
          type="text"
          placeholder={placeholder}
          className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
      </label>
    </div>
  );
}

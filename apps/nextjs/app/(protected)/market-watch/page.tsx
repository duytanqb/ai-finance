import { Clock, Sparkles } from "lucide-react";

const MOCK_PICKS = [
  {
    symbol: "TCB",
    action: "BUY",
    confidence: 82,
    summary:
      "Strong Q4 earnings, PE below industry average, positive fund flow",
    entryPrice: "54,000",
    targetPrice: "62,000",
    date: "25/02/2026",
  },
  {
    symbol: "VCB",
    action: "WATCH",
    confidence: 71,
    summary:
      "Solid fundamentals but price near 52-week high, wait for correction",
    entryPrice: "84,000",
    targetPrice: "95,000",
    date: "25/02/2026",
  },
  {
    symbol: "HPG",
    action: "AVOID",
    confidence: 65,
    summary:
      "Steel sector headwinds, declining margins, negative news sentiment",
    entryPrice: "-",
    targetPrice: "-",
    date: "25/02/2026",
  },
];

const ACTION_STYLES: Record<string, string> = {
  BUY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  WATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  AVOID: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function MarketWatchPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Market Watch
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Daily AI-generated stock picks and research
        </p>
      </div>

      {/* Daily Digest */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Today's Market Summary
          </h2>
          <span className="text-xs text-zinc-400 ml-auto flex items-center gap-1">
            <Clock className="h-3 w-3" /> 25/02/2026 15:30
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          VN-Index closed at 1,284.5 (+0.97%). Banking sector led gains with
          VCB, TCB, and ACB all advancing. Foreign investors net bought 120B
          VND. Steel sector remains under pressure with HPG and HSG declining.
          Market breadth: 245 advancing, 180 declining.
        </p>
      </div>

      {/* AI Picks */}
      <div>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Stocks to Watch
        </h2>
        <div className="space-y-3">
          {MOCK_PICKS.map((pick) => (
            <div
              key={pick.symbol}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {pick.symbol}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${ACTION_STYLES[pick.action]}`}
                  >
                    {pick.action}
                  </span>
                  <span className="text-xs text-zinc-400">
                    Confidence: {pick.confidence}%
                  </span>
                </div>
                <span className="text-xs text-zinc-400">{pick.date}</span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                {pick.summary}
              </p>
              {pick.action === "BUY" && (
                <div className="flex gap-6 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <span className="text-xs text-zinc-500">Entry</span>
                    <p className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {pick.entryPrice}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Target</span>
                    <p className="text-sm font-mono font-medium text-emerald-600">
                      {pick.targetPrice}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

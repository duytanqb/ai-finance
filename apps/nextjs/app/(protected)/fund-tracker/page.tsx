"use client";

import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  PieChart,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface FundInfo {
  short_name: string;
  name: string;
  fund_type: string;
  fund_owner_name: string;
  nav: number | null;
  nav_change_1m: number | null;
  nav_change_3m: number | null;
  nav_change_12m: number | null;
  management_fee: number | null;
}

interface HoldingItem {
  stock_code: string;
  industry: string;
  net_asset_percent: number;
}

interface ConsensusItem {
  symbol: string;
  fund_count: number;
  avg_weight: number;
  total_weight: number;
  industry: string;
  funds: string[];
}

interface SmartMoneyData {
  consensus: ConsensusItem[];
  funds_analyzed: string[];
  fund_performance: Record<
    string,
    {
      name: string;
      nav: number;
      return_1m: number | null;
      return_3m: number | null;
      return_12m: number | null;
      manager: string;
    }
  >;
  all_holdings: Record<string, HoldingItem[]>;
}

function formatReturn(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
}

function returnColor(val: number | null | undefined): string {
  if (val === null || val === undefined) return "text-zinc-400";
  return val >= 0 ? "text-emerald-600" : "text-red-500";
}

function formatNAV(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return Math.round(val).toLocaleString("vi-VN");
}

function shortManager(name: string): string {
  const map: Record<string, string> = {
    "DRAGON CAPITAL": "Dragon Capital",
    VINACAPITAL: "VinaCapital",
    VIETCOMBANK: "VCBF",
    SSI: "SSI",
    MIREA: "Mirae Asset",
    MANULIFE: "Manulife",
    "BẢO VIỆT": "Bảo Việt",
    MB: "MB Capital",
    EASTSPRING: "Eastspring",
    KIM: "KIM",
    IPAAM: "IPAAM",
    "BẢN VIỆT": "Bản Việt",
    SGI: "SGI",
    "DAI-ICHI": "Dai-ichi",
    NTP: "NTP",
    LIGHTHOUSE: "Lighthouse",
    "RỒNG VIỆT": "Rồng Việt",
    "PHÚ HƯNG": "Phú Hưng",
    HD: "HD",
    UOB: "UOB",
    "THÀNH CÔNG": "Thành Công",
    "AN BÌNH": "An Bình",
    "IPA PARTNER": "IPA",
    "FPT CAPITAL": "FPT Capital",
  };
  const upper = name.toUpperCase();
  for (const [key, short] of Object.entries(map)) {
    if (upper.includes(key)) return short;
  }
  return name.length > 20 ? `${name.slice(0, 18)}...` : name;
}

export default function FundTrackerPage() {
  const [funds, setFunds] = useState<FundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartMoney, setSmartMoney] = useState<SmartMoneyData | null>(null);
  const [smartMoneyLoading, setSmartMoneyLoading] = useState(false);
  const [expandedFund, setExpandedFund] = useState<string | null>(null);
  const [fundHoldings, setFundHoldings] = useState<
    Record<
      string,
      {
        holdings: HoldingItem[];
        industry_allocation: { industry: string; net_asset_percent: number }[];
      }
    >
  >({});
  const [fundType, setFundType] = useState<"equity" | "balanced">("equity");
  const [search, setSearch] = useState("");
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(
    null,
  );

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fund?type=${fundType}`);
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.funds || []).sort(
          (a: FundInfo, b: FundInfo) =>
            (b.nav_change_12m ?? -999) - (a.nav_change_12m ?? -999),
        );
        setFunds(sorted);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [fundType]);

  const fetchSmartMoney = useCallback(async () => {
    setSmartMoneyLoading(true);
    try {
      const res = await fetch("/api/fund/smart-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ top_n: 10, min_return_12m: 5.0 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartMoney(data);
      }
    } catch {
      /* ignore */
    } finally {
      setSmartMoneyLoading(false);
    }
  }, []);

  const toggleFundDetail = useCallback(
    async (symbol: string) => {
      if (expandedFund === symbol) {
        setExpandedFund(null);
        return;
      }
      setExpandedFund(symbol);
      if (!fundHoldings[symbol]) {
        try {
          const res = await fetch(`/api/fund/${symbol}`);
          if (res.ok) {
            const data = await res.json();
            setFundHoldings((prev) => ({ ...prev, [symbol]: data }));
          }
        } catch {
          /* ignore */
        }
      }
    },
    [expandedFund, fundHoldings],
  );

  const addToWatchlist = useCallback(async (symbol: string) => {
    setAddingToWatchlist(symbol);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
    } catch {
      /* ignore */
    } finally {
      setAddingToWatchlist(null);
    }
  }, []);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  const filtered = funds.filter(
    (f) =>
      f.short_name.toLowerCase().includes(search.toLowerCase()) ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.fund_owner_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="h-6 w-6 text-emerald-600" />
            Fund Tracker
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Theo dõi danh mục quỹ đầu tư — tìm cổ phiếu &quot;smart money&quot;
            đang mua
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSmartMoney}
          disabled={smartMoneyLoading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {smartMoneyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Smart Money Analysis
        </button>
      </div>

      {smartMoney && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Smart Money Consensus
            </h2>
            <span className="text-xs text-zinc-500">
              Dựa trên {smartMoney.funds_analyzed.length} quỹ có lợi nhuận 12
              tháng tốt nhất
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {smartMoney.funds_analyzed.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                {f}
                {smartMoney.fund_performance[f] && (
                  <span className="ml-1 text-emerald-500">
                    +{smartMoney.fund_performance[f].return_12m?.toFixed(0)}%
                  </span>
                )}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-200 dark:border-emerald-800 text-left text-xs text-zinc-500 uppercase">
                  <th className="py-2 pr-3">Mã CK</th>
                  <th className="py-2 pr-3">Ngành</th>
                  <th className="py-2 pr-3 text-center">Số quỹ nắm</th>
                  <th className="py-2 pr-3 text-right">TB tỷ trọng</th>
                  <th className="py-2 pr-3">Quỹ</th>
                  <th className="py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {smartMoney.consensus
                  .filter((c) => c.fund_count >= 2)
                  .map((c) => (
                    <tr
                      key={c.symbol}
                      className="border-b border-emerald-100 dark:border-emerald-900/30"
                    >
                      <td className="py-2 pr-3">
                        <Link
                          href={`/stocks/${c.symbol}`}
                          className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          {c.symbol}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400 text-xs">
                        {c.industry}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-200 dark:bg-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          {c.fund_count}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-medium">
                        {c.avg_weight.toFixed(1)}%
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {c.funds.map((f) => (
                            <span
                              key={f}
                              className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Link
                            href={`/stocks/${c.symbol}`}
                            className="p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => addToWatchlist(c.symbol)}
                            disabled={addingToWatchlist === c.symbol}
                            className="p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800"
                            title="Thêm Watchlist"
                          >
                            {addingToWatchlist === c.symbol ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <TrendingUp className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setFundType("equity")}
            className={`px-3 py-1.5 text-sm font-medium ${fundType === "equity" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            Cổ phiếu ({funds.length})
          </button>
          <button
            type="button"
            onClick={() => setFundType("balanced")}
            className={`px-3 py-1.5 text-sm font-medium ${fundType === "balanced" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            Cân bằng
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Tìm quỹ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={fetchFunds}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Làm mới"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-left text-xs text-zinc-500 uppercase">
                <th className="py-3 pl-4 pr-2 w-8" />
                <th className="py-3 pr-3">Quỹ</th>
                <th className="py-3 pr-3">Quản lý</th>
                <th className="py-3 pr-3 text-right">NAV</th>
                <th className="py-3 pr-3 text-right">1 tháng</th>
                <th className="py-3 pr-3 text-right">3 tháng</th>
                <th className="py-3 pr-3 text-right">12 tháng</th>
                <th className="py-3 pr-4 text-right">Phí QL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const isExpanded = expandedFund === f.short_name;
                const detail = fundHoldings[f.short_name];
                return (
                  <FundRow
                    key={f.short_name}
                    fund={f}
                    isExpanded={isExpanded}
                    detail={detail}
                    onToggle={() => toggleFundDetail(f.short_name)}
                    onAddWatchlist={addToWatchlist}
                    addingSymbol={addingToWatchlist}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FundRow({
  fund,
  isExpanded,
  detail,
  onToggle,
  onAddWatchlist,
  addingSymbol,
}: {
  fund: FundInfo;
  isExpanded: boolean;
  detail?: {
    holdings: HoldingItem[];
    industry_allocation: { industry: string; net_asset_percent: number }[];
  };
  onToggle: () => void;
  onAddWatchlist: (symbol: string) => void;
  addingSymbol: string | null;
}) {
  return (
    <>
      <tr
        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-3 pl-4 pr-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          )}
        </td>
        <td className="py-3 pr-3">
          <div className="font-semibold">{fund.short_name}</div>
          <div className="text-xs text-zinc-500 truncate max-w-[200px]">
            {fund.name}
          </div>
        </td>
        <td className="py-3 pr-3 text-xs text-zinc-600 dark:text-zinc-400">
          {shortManager(fund.fund_owner_name)}
        </td>
        <td className="py-3 pr-3 text-right font-medium">
          {formatNAV(fund.nav)}
        </td>
        <td
          className={`py-3 pr-3 text-right font-medium ${returnColor(fund.nav_change_1m)}`}
        >
          {formatReturn(fund.nav_change_1m)}
        </td>
        <td
          className={`py-3 pr-3 text-right font-medium ${returnColor(fund.nav_change_3m)}`}
        >
          {formatReturn(fund.nav_change_3m)}
        </td>
        <td
          className={`py-3 pr-3 text-right font-medium ${returnColor(fund.nav_change_12m)}`}
        >
          {formatReturn(fund.nav_change_12m)}
        </td>
        <td className="py-3 pr-4 text-right text-zinc-500">
          {fund.management_fee != null ? `${fund.management_fee}%` : "-"}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-zinc-100 dark:border-zinc-800">
          <td colSpan={8} className="p-0">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4">
              {!detail ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">
                      Top Holdings
                    </h4>
                    <div className="space-y-1">
                      {detail.holdings.map((h) => (
                        <div
                          key={h.stock_code}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/stocks/${h.stock_code}`}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {h.stock_code}
                            </Link>
                            <span className="text-xs text-zinc-500">
                              {h.industry}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {h.net_asset_percent.toFixed(1)}%
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddWatchlist(h.stock_code);
                              }}
                              disabled={addingSymbol === h.stock_code}
                              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                              title="Thêm Watchlist"
                            >
                              {addingSymbol === h.stock_code ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 text-zinc-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">
                      Phân bổ ngành
                    </h4>
                    <div className="space-y-1">
                      {detail.industry_allocation.slice(0, 8).map((ia) => (
                        <div
                          key={ia.industry}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-zinc-600 dark:text-zinc-400 text-xs">
                            {ia.industry}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{
                                  width: `${Math.min(ia.net_asset_percent, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium w-10 text-right">
                              {ia.net_asset_percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

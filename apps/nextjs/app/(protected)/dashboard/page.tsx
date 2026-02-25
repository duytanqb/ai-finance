import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Eye,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { requireAuth } from "@/adapters/guards/auth.guard";

export default async function DashboardPage() {
  const session = await requireAuth();
  const firstName = session.user.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Vietnam Stock Market Overview
        </p>
      </div>

      {/* Market Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MarketCard
          label="VN-Index"
          value="1,284.5"
          change="+12.3"
          changePercent="+0.97%"
          positive
        />
        <MarketCard
          label="HNX-Index"
          value="228.7"
          change="-1.2"
          changePercent="-0.52%"
          positive={false}
        />
        <MarketCard
          label="Portfolio Value"
          value="152.4M"
          change="+3.2M"
          changePercent="+2.15%"
          positive
        />
        <MarketCard
          label="Watchlist Alerts"
          value="3"
          change="stocks hit target"
          changePercent=""
          positive
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickAction
          href="/stocks"
          icon={TrendingUp}
          title="Analyze Stock"
          description="Search and analyze any stock with AI"
        />
        <QuickAction
          href="/portfolio"
          icon={Briefcase}
          title="Portfolio"
          description="Track holdings, P&L, and AI suggestions"
        />
        <QuickAction
          href="/market-watch"
          icon={Eye}
          title="Market Watch"
          description="Daily AI picks and research reports"
        />
      </div>

      {/* Recent AI Reports */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Recent AI Reports
          </h2>
          <Link
            href="/reports"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            View all
          </Link>
        </div>
        <div className="text-center py-12 text-zinc-400">
          <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No reports yet</p>
          <p className="text-xs mt-1">
            Click "Analyze Stock" on any stock page to generate your first
            report
          </p>
        </div>
      </div>
    </div>
  );
}

function MarketCard({
  label,
  value,
  change,
  changePercent,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  changePercent: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
        {value}
      </p>
      <div className="flex items-center gap-1 mt-1">
        {positive ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
        )}
        <span
          className={`text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
        >
          {change} {changePercent}
        </span>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
    >
      <Icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mt-3">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 mt-1">{description}</p>
    </Link>
  );
}

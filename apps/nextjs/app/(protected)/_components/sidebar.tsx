"use client";

import { cn } from "@packages/ui/index";
import {
  Activity,
  BarChart3,
  Briefcase,
  Eye,
  FileText,
  LayoutDashboard,
  LineChart,
  Settings,
  Shield,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Stocks", href: "/stocks", icon: LineChart },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Watchlist", href: "/watchlist", icon: Eye },
  { name: "Market Watch", href: "/market-watch", icon: TrendingUp },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Admin Home", href: "/admin", icon: Shield },
  { name: "Prompts", href: "/admin/prompts", icon: FileText },
  { name: "Usage", href: "/admin/usage", icon: Activity },
];

interface SidebarProps {
  isAdmin: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 lg:flex lg:flex-col">
      <div className="flex h-14 items-center border-b border-zinc-200 dark:border-zinc-800 px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-lg tracking-tight"
        >
          <TrendingUp className="h-5 w-5 text-emerald-600" strokeWidth={2.5} />
          <span>AI Finance</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      {isAdmin && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <p className="px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Admin
          </p>
          <nav className="space-y-0.5">
            {adminNavigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={2} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}

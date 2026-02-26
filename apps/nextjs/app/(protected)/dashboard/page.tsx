import { requireAuth } from "@/adapters/guards/auth.guard";
import { DashboardData } from "./_components/dashboard-data";

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
      <DashboardData />
    </div>
  );
}

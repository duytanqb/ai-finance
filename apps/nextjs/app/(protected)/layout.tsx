import type { ReactElement, ReactNode } from "react";
import { isAdmin } from "@/adapters/guards/admin.guard";
import { requireAuth } from "@/adapters/guards/auth.guard";
import { DashboardHeader } from "./_components/dashboard-header";
import { Sidebar } from "./_components/sidebar";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const session = await requireAuth();
  const admin = isAdmin(session.user.email);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      <Sidebar isAdmin={admin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader user={session.user} isAdmin={admin} />
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-900">
          {children}
        </main>
      </div>
    </div>
  );
}

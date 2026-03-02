import { AlertBell } from "./alert-bell";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

interface DashboardHeaderProps {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  isAdmin: boolean;
}

export function DashboardHeader({ user, isAdmin }: DashboardHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 bg-white dark:bg-zinc-950">
      <MobileNav isAdmin={isAdmin} />
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <AlertBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

interface DashboardHeaderProps {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 bg-white dark:bg-zinc-950">
      <MobileNav />
      <div className="flex-1" />
      <UserMenu user={user} />
    </header>
  );
}

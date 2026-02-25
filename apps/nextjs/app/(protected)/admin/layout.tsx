import type { ReactElement, ReactNode } from "react";
import { requireAdmin } from "@/adapters/guards/admin.guard";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  await requireAdmin();
  return <>{children}</>;
}

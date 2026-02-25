import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { authGuard } from "@/adapters/guards/auth.guard";

export default async function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const guardResult = await authGuard();

  if (guardResult.authenticated) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

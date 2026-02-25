import { redirect } from "next/navigation";
import type { IGetSessionOutputDto } from "@/application/dto/get-session.dto";
import { env } from "@/common/env";
import { requireAuth } from "./auth.guard";

export function isAdmin(email: string): boolean {
  const adminEmails = env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function requireAdmin(
  redirectTo = "/dashboard",
): Promise<IGetSessionOutputDto> {
  const session = await requireAuth();

  if (!isAdmin(session.user.email)) {
    redirect(redirectTo);
  }

  return session;
}

import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { dnseGet } from "@/lib/dnse-client";
import { getDnseCredentials } from "@/lib/dnse-credentials";

function extractAccountNo(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first?.id) return String(first.id);
    if (first?.accountNo) return String(first.accountNo);
    return null;
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (obj.id) return String(obj.id);
    for (const key of ["accounts", "data", "subAccounts"]) {
      if (Array.isArray(obj[key])) {
        const first = (obj[key] as Record<string, unknown>[])[0];
        if (first?.id) return String(first.id);
        if (first?.accountNo) return String(first.accountNo);
      }
    }
  }
  return null;
}

function extractArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["deals", "holdings", "data", "list"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return null;
}

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = await getDnseCredentials(guard.session.user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "DNSE credentials not configured" },
      { status: 404 },
    );
  }

  try {
    const accountsRaw = await dnseGet(
      "/accounts",
      creds.apiKey,
      creds.apiSecret,
    );
    const accountNo = extractAccountNo(accountsRaw);
    if (!accountNo) {
      return NextResponse.json(
        { error: "No sub-account found" },
        { status: 404 },
      );
    }

    const data = await dnseGet(
      `/accounts/${accountNo}/deals`,
      creds.apiKey,
      creds.apiSecret,
      { marketType: "STOCK" },
    );

    const holdings = extractArray(data);
    return NextResponse.json({
      holdings: holdings ?? [],
      _raw_keys:
        data && typeof data === "object" ? Object.keys(data as object) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch holdings";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

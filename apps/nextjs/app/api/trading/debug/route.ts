import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { dnseGet } from "@/lib/dnse-client";
import { getDnseCredentials } from "@/lib/dnse-credentials";

const ENTRADE_BASE = "https://services.entrade.com.vn";

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

  const results: Record<string, unknown> = {};

  try {
    results.accounts = await dnseGet<unknown>(
      "/accounts",
      creds.apiKey,
      creds.apiSecret,
    );
  } catch (e) {
    results.accountsError = e instanceof Error ? e.message : "Unknown error";
  }

  const accountIds: string[] = [];
  if (results.accounts && typeof results.accounts === "object") {
    const raw = results.accounts as Record<string, unknown>;
    const arr = raw.accounts ?? raw.data ?? raw.subAccounts;
    if (Array.isArray(arr)) {
      for (const acc of arr) {
        if (acc.id) accountIds.push(String(acc.id));
        if (acc.accountNo) accountIds.push(String(acc.accountNo));
      }
    }
  }
  results.extractedAccountIds = [...new Set(accountIds)];

  const loanResults: Record<string, unknown>[] = [];
  for (const accId of [...new Set(accountIds)]) {
    try {
      const loanRaw = await dnseGet<unknown>(
        `/accounts/${accId}/loan-packages`,
        creds.apiKey,
        creds.apiSecret,
      );
      loanResults.push({
        source: "OpenAPI",
        accountId: accId,
        path: `/accounts/${accId}/loan-packages`,
        response: loanRaw,
      });
    } catch (e) {
      loanResults.push({
        source: "OpenAPI",
        accountId: accId,
        path: `/accounts/${accId}/loan-packages`,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }

    try {
      const res = await fetch(
        `${ENTRADE_BASE}/dnse-order-service/accounts/${accId}/loan-packages`,
        { method: "GET", cache: "no-store" },
      );
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      loanResults.push({
        source: "Entrade",
        accountId: accId,
        path: `/dnse-order-service/accounts/${accId}/loan-packages`,
        status: res.status,
        response: parsed,
      });
    } catch (e) {
      loanResults.push({
        source: "Entrade",
        accountId: accId,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }
  results.loanPackages = loanResults;

  return NextResponse.json(results);
}

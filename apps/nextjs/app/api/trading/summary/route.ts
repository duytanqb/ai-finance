import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { dnseGet } from "@/lib/dnse-client";
import { getDnseCredentials } from "@/lib/dnse-credentials";

const accountCache = new Map<
  string,
  { data: unknown; accountNo: string; ts: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    // DNSE may return {id, dealAccount, ...} directly
    if (obj.id) return String(obj.id);
    // Or nested: {accounts: [...]} or {data: [...]} or {subAccounts: [...]}
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

  const debug: Record<string, unknown> = {};

  try {
    const cacheKey = guard.session.user.id;
    const cached = accountCache.get(cacheKey);
    let accountData: unknown;
    let accountNo: string;

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      accountData = cached.data;
      accountNo = cached.accountNo;
      debug.accountSource = "cache";
    } else {
      accountData = await dnseGet("/accounts", creds.apiKey, creds.apiSecret);
      debug.accountsRaw = accountData;
      const extracted = extractAccountNo(accountData);
      if (!extracted) {
        return NextResponse.json(
          { error: "No account found in DNSE response", debug },
          { status: 404 },
        );
      }
      accountNo = extracted;
      accountCache.set(cacheKey, {
        data: accountData,
        accountNo,
        ts: Date.now(),
      });
    }

    debug.accountNo = accountNo;

    const [balanceRes, holdingsRes, ordersRes] = await Promise.allSettled([
      dnseGet(`/accounts/${accountNo}/balances`, creds.apiKey, creds.apiSecret),
      dnseGet(`/accounts/${accountNo}/deals`, creds.apiKey, creds.apiSecret, {
        marketType: "STOCK",
      }),
      dnseGet(`/accounts/${accountNo}/orders`, creds.apiKey, creds.apiSecret, {
        marketType: "STOCK",
      }),
    ]);

    debug.holdingsStatus = holdingsRes.status;
    if (holdingsRes.status === "rejected") {
      debug.holdingsError =
        holdingsRes.reason instanceof Error
          ? holdingsRes.reason.message
          : String(holdingsRes.reason);
    }
    debug.ordersStatus = ordersRes.status;
    if (ordersRes.status === "rejected") {
      debug.ordersError =
        ordersRes.reason instanceof Error
          ? ordersRes.reason.message
          : String(ordersRes.reason);
    }

    return NextResponse.json({
      account: accountData,
      balance: balanceRes.status === "fulfilled" ? balanceRes.value : null,
      holdings: holdingsRes.status === "fulfilled" ? holdingsRes.value : null,
      orders: ordersRes.status === "fulfilled" ? ordersRes.value : null,
      _debug: debug,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch trading data";
    debug.error = message;
    return NextResponse.json({ error: message, debug }, { status: 502 });
  }
}

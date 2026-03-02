import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { dnseGet, dnsePost } from "@/lib/dnse-client";
import { getDnseCredentials } from "@/lib/dnse-credentials";

interface AccountsResponse {
  accounts?: { id: number }[];
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { symbol, side, quantity, price, orderType, tradingToken } = body;

  if (!symbol || !side || !quantity || !tradingToken) {
    return NextResponse.json(
      {
        error: "Missing required fields: symbol, side, quantity, tradingToken",
      },
      { status: 400 },
    );
  }

  if (!["BUY", "SELL"].includes(side)) {
    return NextResponse.json(
      { error: "side must be BUY or SELL" },
      { status: 400 },
    );
  }

  try {
    const accounts = await dnseGet<AccountsResponse>(
      "/accounts",
      creds.apiKey,
      creds.apiSecret,
    );
    const accountNo = accounts.accounts?.[0]?.id;
    if (!accountNo) {
      return NextResponse.json(
        { error: "No sub-account found" },
        { status: 404 },
      );
    }

    const orderBody = {
      symbol: symbol.toUpperCase(),
      side,
      quantity: Number(quantity),
      price: price ? Number(price) : undefined,
      orderType: orderType || "LO",
      accountNo,
    };

    const data = await dnsePost(
      "/accounts/orders",
      creds.apiKey,
      creds.apiSecret,
      orderBody,
      { marketType: "STOCK" },
      { "trading-token": tradingToken },
    );
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to place order";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

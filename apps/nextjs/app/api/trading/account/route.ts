import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { dnseGet } from "@/lib/dnse-client";
import { getDnseCredentials } from "@/lib/dnse-credentials";

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
    const data = await dnseGet("/accounts", creds.apiKey, creds.apiSecret);
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch account info";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { dnsePost } from "@/lib/dnse-client";
import { getDnseCredentials } from "@/lib/dnse-credentials";

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
  const passcode = body.passcode;
  const otpType = body.otpType || "smart_otp";
  if (!passcode || typeof passcode !== "string") {
    return NextResponse.json(
      { error: "Passcode is required" },
      { status: 400 },
    );
  }

  try {
    const data = await dnsePost(
      "/registration/trading-token",
      creds.apiKey,
      creds.apiSecret,
      { otpType, passcode },
    );
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to verify OTP";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { db } from "@packages/drizzle/config";
import { userCredential } from "@packages/drizzle/schema/stock";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { stockServicePost } from "@/lib/stock-service";

export async function POST() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({ encryptedCredentials: userCredential.encryptedCredentials })
    .from(userCredential)
    .where(
      and(
        eq(userCredential.userId, guard.session.user.id),
        eq(userCredential.provider, "dnse"),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "No DNSE credentials configured" },
      { status: 404 },
    );
  }

  try {
    const creds = JSON.parse(row.encryptedCredentials);
    const result = (await stockServicePost("/api/dnse/verify", {
      api_key: creds.apiKey,
      api_secret: creds.apiSecret,
    })) as { valid: boolean; error?: string };

    if (result.valid) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: result.error || "Invalid credentials" },
      { status: 400 },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to verify credentials";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

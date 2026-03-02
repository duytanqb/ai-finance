import { db } from "@packages/drizzle/config";
import { userCredential } from "@packages/drizzle/schema/stock";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: userCredential.id,
      provider: userCredential.provider,
      encryptedCredentials: userCredential.encryptedCredentials,
      createdAt: userCredential.createdAt,
      updatedAt: userCredential.updatedAt,
    })
    .from(userCredential)
    .where(
      and(
        eq(userCredential.userId, guard.session.user.id),
        eq(userCredential.provider, "dnse"),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ configured: false });
  }

  let maskedKey = "";
  try {
    const creds = JSON.parse(row.encryptedCredentials);
    const key = creds.apiKey || "";
    maskedKey =
      key.length > 8
        ? `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`
        : "*".repeat(key.length);
  } catch {
    maskedKey = "***";
  }

  return NextResponse.json({
    configured: true,
    provider: row.provider,
    maskedApiKey: maskedKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PUT(request: Request) {
  try {
    const guard = await authGuard();
    if (!guard.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, apiSecret } = body;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "API Key and API Secret are required" },
        { status: 400 },
      );
    }

    const credentials = JSON.stringify({ apiKey, apiSecret });
    const userId = guard.session.user.id;

    const [existing] = await db
      .select({ id: userCredential.id })
      .from(userCredential)
      .where(
        and(
          eq(userCredential.userId, userId),
          eq(userCredential.provider, "dnse"),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(userCredential)
        .set({
          encryptedCredentials: credentials,
          updatedAt: new Date(),
        })
        .where(eq(userCredential.id, existing.id));
    } else {
      await db.insert(userCredential).values({
        userId,
        provider: "dnse",
        encryptedCredentials: credentials,
      });
    }

    return NextResponse.json({ saved: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to save credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(userCredential)
    .where(
      and(
        eq(userCredential.userId, guard.session.user.id),
        eq(userCredential.provider, "dnse"),
      ),
    );

  return NextResponse.json({ deleted: true });
}

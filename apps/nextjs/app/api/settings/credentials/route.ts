import { db } from "@packages/drizzle/config";
import { userCredential } from "@packages/drizzle/schema/stock";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: userCredential.id,
      provider: userCredential.provider,
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

  return NextResponse.json({
    configured: true,
    provider: row.provider,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PUT(request: Request) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const encrypted = encrypt(JSON.stringify({ username, password }));
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
        encryptedCredentials: encrypted,
        updatedAt: new Date(),
      })
      .where(eq(userCredential.id, existing.id));
  } else {
    await db.insert(userCredential).values({
      userId,
      provider: "dnse",
      encryptedCredentials: encrypted,
    });
  }

  return NextResponse.json({ saved: true });
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

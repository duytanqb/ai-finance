import { and, db, desc, eq, inArray } from "@packages/drizzle";
import { priceAlert } from "@packages/drizzle/schema";
import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await db
    .select()
    .from(priceAlert)
    .where(eq(priceAlert.userId, guard.session.user.id))
    .orderBy(desc(priceAlert.createdAt))
    .limit(20);

  return NextResponse.json({ alerts });
}

export async function PUT(request: NextRequest) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ids: string[] = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await db
    .update(priceAlert)
    .set({ read: true })
    .where(
      and(
        eq(priceAlert.userId, guard.session.user.id),
        inArray(priceAlert.id, ids),
      ),
    );

  return NextResponse.json({ ok: true });
}

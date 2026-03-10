import { db, desc, eq } from "@packages/drizzle";
import { fundSnapshot } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  try {
    if (symbol) {
      const snapshots = await db
        .select()
        .from(fundSnapshot)
        .where(eq(fundSnapshot.fundSymbol, symbol.toUpperCase()))
        .orderBy(desc(fundSnapshot.snapshotDate))
        .limit(4);
      return NextResponse.json({ snapshots });
    }

    const latest = await db
      .select()
      .from(fundSnapshot)
      .orderBy(desc(fundSnapshot.createdAt))
      .limit(50);
    return NextResponse.json({ snapshots: latest });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch snapshots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const records = body.snapshots as Array<{
      fund_symbol: string;
      fund_name: string;
      snapshot_date: string;
      nav: number | null;
      holdings: unknown;
      industry_allocation: unknown;
    }>;

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: "No snapshots provided" },
        { status: 400 },
      );
    }

    let saved = 0;
    for (const r of records) {
      try {
        await db
          .insert(fundSnapshot)
          .values({
            fundSymbol: r.fund_symbol,
            fundName: r.fund_name,
            snapshotDate: r.snapshot_date,
            nav: r.nav,
            holdings: r.holdings,
            industryAllocation: r.industry_allocation,
          })
          .onConflictDoUpdate({
            target: [fundSnapshot.fundSymbol, fundSnapshot.snapshotDate],
            set: {
              nav: r.nav,
              holdings: r.holdings,
              industryAllocation: r.industry_allocation,
            },
          });
        saved++;
      } catch {
        // skip failed individual snapshot saves
      }
    }

    return NextResponse.json({ saved, total: records.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save snapshots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

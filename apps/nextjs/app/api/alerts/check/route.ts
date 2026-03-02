import { and, db, eq, gte, isNotNull, or } from "@packages/drizzle";
import { portfolioHolding, priceAlert } from "@packages/drizzle/schema";
import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface PriceBoardItem {
  symbol: string;
  match_price?: number;
  close?: number;
  last_price?: number;
  [key: string]: unknown;
}

export async function POST() {
  try {
    const holdings = await db
      .select()
      .from(portfolioHolding)
      .where(
        or(
          isNotNull(portfolioHolding.stopLoss),
          isNotNull(portfolioHolding.takeProfit),
        ),
      );

    if (holdings.length === 0) {
      return NextResponse.json({ alertsCreated: 0 });
    }

    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    const symbolsParam = symbols.join(",");

    const priceMap: Record<string, number> = {};
    try {
      const boardRes = (await stockServiceGet(
        `/api/price/board?symbols=${symbolsParam}`,
      )) as { data: PriceBoardItem[] };

      for (const item of boardRes.data) {
        const price = item.match_price ?? item.close ?? item.last_price ?? null;
        if (price && price > 0) {
          priceMap[item.symbol.toUpperCase()] = price;
        }
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch prices" },
        { status: 502 },
      );
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let alertsCreated = 0;

    for (const holding of holdings) {
      const currentPrice = priceMap[holding.symbol.toUpperCase()];
      if (!currentPrice) continue;

      if (holding.stopLoss && currentPrice <= holding.stopLoss) {
        const exists = await db
          .select({ id: priceAlert.id })
          .from(priceAlert)
          .where(
            and(
              eq(priceAlert.holdingId, holding.id),
              eq(priceAlert.alertType, "stop_loss"),
              gte(priceAlert.createdAt, oneDayAgo),
            ),
          )
          .limit(1);

        if (exists.length === 0) {
          await db.insert(priceAlert).values({
            userId: holding.userId,
            holdingId: holding.id,
            symbol: holding.symbol,
            alertType: "stop_loss",
            triggerPrice: holding.stopLoss,
            currentPrice,
            message: `${holding.symbol} đã chạm Stop Loss ${holding.stopLoss.toLocaleString("vi-VN")}đ (giá hiện tại: ${currentPrice.toLocaleString("vi-VN")}đ)`,
          });
          alertsCreated++;
        }
      }

      if (holding.takeProfit && currentPrice >= holding.takeProfit) {
        const exists = await db
          .select({ id: priceAlert.id })
          .from(priceAlert)
          .where(
            and(
              eq(priceAlert.holdingId, holding.id),
              eq(priceAlert.alertType, "take_profit"),
              gte(priceAlert.createdAt, oneDayAgo),
            ),
          )
          .limit(1);

        if (exists.length === 0) {
          await db.insert(priceAlert).values({
            userId: holding.userId,
            holdingId: holding.id,
            symbol: holding.symbol,
            alertType: "take_profit",
            triggerPrice: holding.takeProfit,
            currentPrice,
            message: `${holding.symbol} đã chạm Take Profit ${holding.takeProfit.toLocaleString("vi-VN")}đ (giá hiện tại: ${currentPrice.toLocaleString("vi-VN")}đ)`,
          });
          alertsCreated++;
        }
      }
    }

    return NextResponse.json({ alertsCreated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to check alerts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { Result, UUID } from "@packages/ddd-kit";
import type { portfolioHolding as portfolioHoldingTable } from "@packages/drizzle/schema";
import { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";
import { PortfolioHoldingId } from "@/domain/portfolio/portfolio-holding-id";
import { AveragePrice } from "@/domain/portfolio/value-objects/average-price.vo";
import type { InvestmentHorizonType } from "@/domain/portfolio/value-objects/investment-horizon.vo";
import { InvestmentHorizon } from "@/domain/portfolio/value-objects/investment-horizon.vo";
import { Quantity } from "@/domain/portfolio/value-objects/quantity.vo";
import { StockSymbol } from "@/domain/portfolio/value-objects/symbol.vo";

type PortfolioHoldingRecord = typeof portfolioHoldingTable.$inferSelect;

export function portfolioHoldingToDomain(
  record: PortfolioHoldingRecord,
): Result<PortfolioHolding> {
  const symbolResult = StockSymbol.create(record.symbol);
  const quantityResult = Quantity.create(record.quantity);
  const averagePriceResult = AveragePrice.create(record.averagePrice);
  const horizonResult = InvestmentHorizon.create(
    record.horizon as InvestmentHorizonType,
  );

  const combined = Result.combine([
    symbolResult,
    quantityResult,
    averagePriceResult,
    horizonResult,
  ]);
  if (combined.isFailure) {
    return Result.fail(
      `Invalid portfolio holding data: ${combined.getError()}`,
    );
  }

  return Result.ok(
    PortfolioHolding.reconstitute(
      {
        userId: record.userId,
        symbol: symbolResult.getValue(),
        quantity: quantityResult.getValue(),
        averagePrice: averagePriceResult.getValue(),
        horizon: horizonResult.getValue(),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt ?? undefined,
      },
      PortfolioHoldingId.create(new UUID(record.id)),
    ),
  );
}

type PortfolioHoldingPersistence = typeof portfolioHoldingTable.$inferInsert;

export function portfolioHoldingToPersistence(
  holding: PortfolioHolding,
): PortfolioHoldingPersistence {
  return {
    id: String(holding.id.value),
    userId: holding.get("userId"),
    symbol: holding.get("symbol").value,
    quantity: holding.get("quantity").value,
    averagePrice: holding.get("averagePrice").value,
    horizon: holding.get("horizon").value,
    createdAt: holding.get("createdAt"),
    updatedAt: holding._props.updatedAt ?? null,
  };
}

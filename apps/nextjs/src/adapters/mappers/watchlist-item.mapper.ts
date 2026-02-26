import { Option, Result, UUID } from "@packages/ddd-kit";
import type { watchlistItem as watchlistItemTable } from "@packages/drizzle/schema";
import { StockSymbol } from "@/domain/portfolio/value-objects/symbol.vo";
import { Notes } from "@/domain/watchlist/value-objects/notes.vo";
import { TargetPrice } from "@/domain/watchlist/value-objects/target-price.vo";
import { WatchlistItem } from "@/domain/watchlist/watchlist-item.aggregate";
import { WatchlistItemId } from "@/domain/watchlist/watchlist-item-id";

type WatchlistItemRecord = typeof watchlistItemTable.$inferSelect;

export function watchlistItemToDomain(
  record: WatchlistItemRecord,
): Result<WatchlistItem> {
  const symbolResult = StockSymbol.create(record.symbol);
  if (symbolResult.isFailure) {
    return Result.fail(
      `Invalid watchlist item data: ${symbolResult.getError()}`,
    );
  }

  let targetPriceOption: Option<TargetPrice> = Option.none();
  if (record.targetPrice !== null) {
    const targetPriceResult = TargetPrice.create(record.targetPrice);
    if (targetPriceResult.isFailure) {
      return Result.fail(
        `Invalid watchlist item data: ${targetPriceResult.getError()}`,
      );
    }
    targetPriceOption = Option.some(targetPriceResult.getValue());
  }

  let notesOption: Option<Notes> = Option.none();
  if (record.notes !== null) {
    const notesResult = Notes.create(record.notes);
    if (notesResult.isFailure) {
      return Result.fail(
        `Invalid watchlist item data: ${notesResult.getError()}`,
      );
    }
    notesOption = Option.some(notesResult.getValue());
  }

  return Result.ok(
    WatchlistItem.reconstitute(
      {
        userId: record.userId,
        symbol: symbolResult.getValue(),
        targetPrice: targetPriceOption,
        notes: notesOption,
        createdAt: record.createdAt,
      },
      WatchlistItemId.create(new UUID(record.id)),
    ),
  );
}

type WatchlistItemPersistence = typeof watchlistItemTable.$inferInsert;

export function watchlistItemToPersistence(
  item: WatchlistItem,
): WatchlistItemPersistence {
  return {
    id: String(item.id.value),
    userId: item.get("userId"),
    symbol: item.get("symbol").value,
    targetPrice: item.get("targetPrice").toNull()?.value ?? null,
    notes: item.get("notes").toNull()?.value ?? null,
    createdAt: item.get("createdAt"),
  };
}

import {
  createPaginatedResult,
  DEFAULT_PAGINATION,
  Option,
  type PaginatedResult,
  type PaginationParams,
  Result,
} from "@packages/ddd-kit";
import {
  and,
  type DbClient,
  db,
  eq,
  type Transaction,
} from "@packages/drizzle";
import { watchlistItem as watchlistItemTable } from "@packages/drizzle/schema";
import {
  watchlistItemToDomain,
  watchlistItemToPersistence,
} from "@/adapters/mappers/watchlist-item.mapper";
import type { IWatchlistRepository } from "@/application/ports/watchlist-repository.port";
import type { WatchlistItem } from "@/domain/watchlist/watchlist-item.aggregate";
import type { WatchlistItemId } from "@/domain/watchlist/watchlist-item-id";

type ItemRecord = typeof watchlistItemTable.$inferSelect;

export class DrizzleWatchlistRepository implements IWatchlistRepository {
  private getDb(trx?: Transaction): DbClient | Transaction {
    return trx ?? db;
  }

  private mapSingleRecord(
    record: ItemRecord | undefined,
  ): Result<Option<WatchlistItem>> {
    if (!record) {
      return Result.ok(Option.none());
    }
    const itemResult = watchlistItemToDomain(record);
    if (itemResult.isFailure) {
      return Result.fail(itemResult.getError());
    }
    return Result.ok(Option.some(itemResult.getValue()));
  }

  private mapRecords(records: ItemRecord[]): Result<WatchlistItem[]> {
    const items: WatchlistItem[] = [];
    for (const record of records) {
      const itemResult = watchlistItemToDomain(record);
      if (itemResult.isFailure) {
        return Result.fail(itemResult.getError());
      }
      items.push(itemResult.getValue());
    }
    return Result.ok(items);
  }

  async create(
    entity: WatchlistItem,
    trx?: Transaction,
  ): Promise<Result<WatchlistItem>> {
    try {
      const data = watchlistItemToPersistence(entity);
      await this.getDb(trx)
        .insert(watchlistItemTable)
        .values({
          ...data,
          createdAt: data.createdAt ?? new Date(),
        });
      return Result.ok(entity);
    } catch (error) {
      return Result.fail(`Failed to create watchlist item: ${error}`);
    }
  }

  async update(
    entity: WatchlistItem,
    trx?: Transaction,
  ): Promise<Result<WatchlistItem>> {
    try {
      const data = watchlistItemToPersistence(entity);
      await this.getDb(trx)
        .update(watchlistItemTable)
        .set(data)
        .where(eq(watchlistItemTable.id, String(entity.id.value)));
      return Result.ok(entity);
    } catch (error) {
      return Result.fail(`Failed to update watchlist item: ${error}`);
    }
  }

  async delete(
    id: WatchlistItemId,
    trx?: Transaction,
  ): Promise<Result<WatchlistItemId>> {
    try {
      await this.getDb(trx)
        .delete(watchlistItemTable)
        .where(eq(watchlistItemTable.id, String(id.value)));
      return Result.ok(id);
    } catch (error) {
      return Result.fail(`Failed to delete watchlist item: ${error}`);
    }
  }

  async findById(id: WatchlistItemId): Promise<Result<Option<WatchlistItem>>> {
    try {
      const result = await db
        .select()
        .from(watchlistItemTable)
        .where(eq(watchlistItemTable.id, String(id.value)))
        .limit(1);
      return this.mapSingleRecord(result[0]);
    } catch (error) {
      return Result.fail(`Failed to find watchlist item by id: ${error}`);
    }
  }

  async findByUserId(
    userId: string,
  ): Promise<Result<PaginatedResult<WatchlistItem>>> {
    try {
      const records = await db
        .select()
        .from(watchlistItemTable)
        .where(eq(watchlistItemTable.userId, userId));

      const itemsResult = this.mapRecords(records);
      if (itemsResult.isFailure) {
        return Result.fail(itemsResult.getError());
      }

      const items = itemsResult.getValue();
      return Result.ok(
        createPaginatedResult(
          items,
          { page: 1, limit: items.length || 1 },
          items.length,
        ),
      );
    } catch (error) {
      return Result.fail(`Failed to find watchlist items: ${error}`);
    }
  }

  async findByUserAndSymbol(
    userId: string,
    symbol: string,
  ): Promise<Result<Option<WatchlistItem>>> {
    try {
      const result = await db
        .select()
        .from(watchlistItemTable)
        .where(
          and(
            eq(watchlistItemTable.userId, userId),
            eq(watchlistItemTable.symbol, symbol),
          ),
        )
        .limit(1);
      return this.mapSingleRecord(result[0]);
    } catch (error) {
      return Result.fail(`Failed to find watchlist item: ${error}`);
    }
  }

  async findAll(
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<Result<PaginatedResult<WatchlistItem>>> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;

      const [records, countResult] = await Promise.all([
        db
          .select()
          .from(watchlistItemTable)
          .limit(pagination.limit)
          .offset(offset),
        this.count(),
      ]);

      if (countResult.isFailure) {
        return Result.fail(countResult.getError());
      }

      const itemsResult = this.mapRecords(records);
      if (itemsResult.isFailure) {
        return Result.fail(itemsResult.getError());
      }

      return Result.ok(
        createPaginatedResult(
          itemsResult.getValue(),
          pagination,
          countResult.getValue(),
        ),
      );
    } catch (error) {
      return Result.fail(`Failed to find all watchlist items: ${error}`);
    }
  }

  async findMany(
    props: Partial<WatchlistItem["_props"]>,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<Result<PaginatedResult<WatchlistItem>>> {
    try {
      const userId = props.userId;
      if (!userId) {
        return this.findAll(pagination);
      }
      return this.findByUserId(userId);
    } catch (error) {
      return Result.fail(`Failed to find watchlist items: ${error}`);
    }
  }

  async findBy(
    props: Partial<WatchlistItem["_props"]>,
  ): Promise<Result<Option<WatchlistItem>>> {
    try {
      const userId = props.userId;
      const symbol = props.symbol?.value;
      if (!userId || !symbol) {
        return Result.ok(Option.none());
      }
      return this.findByUserAndSymbol(userId, symbol);
    } catch (error) {
      return Result.fail(`Failed to find watchlist item: ${error}`);
    }
  }

  async exists(id: WatchlistItemId): Promise<Result<boolean>> {
    try {
      const result = await db
        .select({ id: watchlistItemTable.id })
        .from(watchlistItemTable)
        .where(eq(watchlistItemTable.id, String(id.value)))
        .limit(1);
      return Result.ok(result.length > 0);
    } catch (error) {
      return Result.fail(`Failed to check watchlist item existence: ${error}`);
    }
  }

  async count(): Promise<Result<number>> {
    try {
      const result = await db.select().from(watchlistItemTable);
      return Result.ok(result.length);
    } catch (error) {
      return Result.fail(`Failed to count watchlist items: ${error}`);
    }
  }
}

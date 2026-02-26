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
import { portfolioHolding as portfolioHoldingTable } from "@packages/drizzle/schema";
import {
  portfolioHoldingToDomain,
  portfolioHoldingToPersistence,
} from "@/adapters/mappers/portfolio-holding.mapper";
import type { IPortfolioRepository } from "@/application/ports/portfolio-repository.port";
import type { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";
import type { PortfolioHoldingId } from "@/domain/portfolio/portfolio-holding-id";

type HoldingRecord = typeof portfolioHoldingTable.$inferSelect;

export class DrizzlePortfolioRepository implements IPortfolioRepository {
  private getDb(trx?: Transaction): DbClient | Transaction {
    return trx ?? db;
  }

  private mapSingleRecord(
    record: HoldingRecord | undefined,
  ): Result<Option<PortfolioHolding>> {
    if (!record) {
      return Result.ok(Option.none());
    }
    const holdingResult = portfolioHoldingToDomain(record);
    if (holdingResult.isFailure) {
      return Result.fail(holdingResult.getError());
    }
    return Result.ok(Option.some(holdingResult.getValue()));
  }

  private mapRecords(records: HoldingRecord[]): Result<PortfolioHolding[]> {
    const holdings: PortfolioHolding[] = [];
    for (const record of records) {
      const holdingResult = portfolioHoldingToDomain(record);
      if (holdingResult.isFailure) {
        return Result.fail(holdingResult.getError());
      }
      holdings.push(holdingResult.getValue());
    }
    return Result.ok(holdings);
  }

  async create(
    entity: PortfolioHolding,
    trx?: Transaction,
  ): Promise<Result<PortfolioHolding>> {
    try {
      const data = portfolioHoldingToPersistence(entity);
      await this.getDb(trx)
        .insert(portfolioHoldingTable)
        .values({
          ...data,
          createdAt: data.createdAt ?? new Date(),
        });
      return Result.ok(entity);
    } catch (error) {
      return Result.fail(`Failed to create portfolio holding: ${error}`);
    }
  }

  async update(
    entity: PortfolioHolding,
    trx?: Transaction,
  ): Promise<Result<PortfolioHolding>> {
    try {
      const data = portfolioHoldingToPersistence(entity);
      await this.getDb(trx)
        .update(portfolioHoldingTable)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(portfolioHoldingTable.id, String(entity.id.value)));
      return Result.ok(entity);
    } catch (error) {
      return Result.fail(`Failed to update portfolio holding: ${error}`);
    }
  }

  async delete(
    id: PortfolioHoldingId,
    trx?: Transaction,
  ): Promise<Result<PortfolioHoldingId>> {
    try {
      await this.getDb(trx)
        .delete(portfolioHoldingTable)
        .where(eq(portfolioHoldingTable.id, String(id.value)));
      return Result.ok(id);
    } catch (error) {
      return Result.fail(`Failed to delete portfolio holding: ${error}`);
    }
  }

  async findById(
    id: PortfolioHoldingId,
  ): Promise<Result<Option<PortfolioHolding>>> {
    try {
      const result = await db
        .select()
        .from(portfolioHoldingTable)
        .where(eq(portfolioHoldingTable.id, String(id.value)))
        .limit(1);
      return this.mapSingleRecord(result[0]);
    } catch (error) {
      return Result.fail(`Failed to find portfolio holding by id: ${error}`);
    }
  }

  async findByUserId(
    userId: string,
  ): Promise<Result<PaginatedResult<PortfolioHolding>>> {
    try {
      const records = await db
        .select()
        .from(portfolioHoldingTable)
        .where(eq(portfolioHoldingTable.userId, userId));

      const holdingsResult = this.mapRecords(records);
      if (holdingsResult.isFailure) {
        return Result.fail(holdingsResult.getError());
      }

      const holdings = holdingsResult.getValue();
      return Result.ok(
        createPaginatedResult(
          holdings,
          { page: 1, limit: holdings.length || 1 },
          holdings.length,
        ),
      );
    } catch (error) {
      return Result.fail(`Failed to find portfolio holdings: ${error}`);
    }
  }

  async findByUserAndSymbol(
    userId: string,
    symbol: string,
  ): Promise<Result<Option<PortfolioHolding>>> {
    try {
      const result = await db
        .select()
        .from(portfolioHoldingTable)
        .where(
          and(
            eq(portfolioHoldingTable.userId, userId),
            eq(portfolioHoldingTable.symbol, symbol),
          ),
        )
        .limit(1);
      return this.mapSingleRecord(result[0]);
    } catch (error) {
      return Result.fail(`Failed to find portfolio holding: ${error}`);
    }
  }

  async findAll(
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<Result<PaginatedResult<PortfolioHolding>>> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;

      const [records, countResult] = await Promise.all([
        db
          .select()
          .from(portfolioHoldingTable)
          .limit(pagination.limit)
          .offset(offset),
        this.count(),
      ]);

      if (countResult.isFailure) {
        return Result.fail(countResult.getError());
      }

      const holdingsResult = this.mapRecords(records);
      if (holdingsResult.isFailure) {
        return Result.fail(holdingsResult.getError());
      }

      return Result.ok(
        createPaginatedResult(
          holdingsResult.getValue(),
          pagination,
          countResult.getValue(),
        ),
      );
    } catch (error) {
      return Result.fail(`Failed to find all portfolio holdings: ${error}`);
    }
  }

  async findMany(
    props: Partial<PortfolioHolding["_props"]>,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<Result<PaginatedResult<PortfolioHolding>>> {
    try {
      const userId = props.userId;
      if (!userId) {
        return this.findAll(pagination);
      }
      return this.findByUserId(userId);
    } catch (error) {
      return Result.fail(`Failed to find portfolio holdings: ${error}`);
    }
  }

  async findBy(
    props: Partial<PortfolioHolding["_props"]>,
  ): Promise<Result<Option<PortfolioHolding>>> {
    try {
      const userId = props.userId;
      const symbol = props.symbol?.value;
      if (!userId || !symbol) {
        return Result.ok(Option.none());
      }
      return this.findByUserAndSymbol(userId, symbol);
    } catch (error) {
      return Result.fail(`Failed to find portfolio holding: ${error}`);
    }
  }

  async exists(id: PortfolioHoldingId): Promise<Result<boolean>> {
    try {
      const result = await db
        .select({ id: portfolioHoldingTable.id })
        .from(portfolioHoldingTable)
        .where(eq(portfolioHoldingTable.id, String(id.value)))
        .limit(1);
      return Result.ok(result.length > 0);
    } catch (error) {
      return Result.fail(
        `Failed to check portfolio holding existence: ${error}`,
      );
    }
  }

  async count(): Promise<Result<number>> {
    try {
      const result = await db.select().from(portfolioHoldingTable);
      return Result.ok(result.length);
    } catch (error) {
      return Result.fail(`Failed to count portfolio holdings: ${error}`);
    }
  }
}

import type {
  BaseRepository,
  Option,
  PaginatedResult,
  Result,
} from "@packages/ddd-kit";
import type { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";
import type { PortfolioHoldingId } from "@/domain/portfolio/portfolio-holding-id";

export interface IPortfolioRepository extends BaseRepository<PortfolioHolding> {
  findById(id: PortfolioHoldingId): Promise<Result<Option<PortfolioHolding>>>;
  findByUserId(
    userId: string,
  ): Promise<Result<PaginatedResult<PortfolioHolding>>>;
  findByUserAndSymbol(
    userId: string,
    symbol: string,
  ): Promise<Result<Option<PortfolioHolding>>>;
}

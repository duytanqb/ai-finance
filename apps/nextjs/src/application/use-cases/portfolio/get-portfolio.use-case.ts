import { Result, type UseCase } from "@packages/ddd-kit";
import type {
  IGetPortfolioInputDto,
  IGetPortfolioOutputDto,
  IHoldingDto,
} from "@/application/dto/portfolio/get-portfolio.dto";
import type { IPortfolioRepository } from "@/application/ports/portfolio-repository.port";
import type { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";

export class GetPortfolioUseCase
  implements UseCase<IGetPortfolioInputDto, IGetPortfolioOutputDto>
{
  constructor(private readonly portfolioRepo: IPortfolioRepository) {}

  async execute(
    input: IGetPortfolioInputDto,
  ): Promise<Result<IGetPortfolioOutputDto>> {
    const result = await this.portfolioRepo.findByUserId(input.userId);
    if (result.isFailure) return Result.fail(result.getError());

    const paginatedResult = result.getValue();

    return Result.ok({
      holdings: paginatedResult.data.map(this.toDto),
      totalHoldings: paginatedResult.pagination.total,
    });
  }

  private toDto(holding: PortfolioHolding): IHoldingDto {
    return {
      id: String(holding.id.value),
      userId: holding.get("userId"),
      symbol: holding.get("symbol").value,
      quantity: holding.get("quantity").value,
      averagePrice: holding.get("averagePrice").value,
      horizon: holding.get("horizon").value,
      stopLoss: holding.get("stopLoss"),
      takeProfit: holding.get("takeProfit"),
      createdAt: holding.get("createdAt"),
      updatedAt: holding._props.updatedAt,
    };
  }
}

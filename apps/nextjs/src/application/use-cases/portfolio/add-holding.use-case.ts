import { match, Result, type UseCase } from "@packages/ddd-kit";
import type {
  IAddHoldingInputDto,
  IAddHoldingOutputDto,
} from "@/application/dto/portfolio/add-holding.dto";
import type { IEventDispatcher } from "@/application/ports/event-dispatcher.port";
import type { IPortfolioRepository } from "@/application/ports/portfolio-repository.port";
import { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";
import { AveragePrice } from "@/domain/portfolio/value-objects/average-price.vo";
import { InvestmentHorizon } from "@/domain/portfolio/value-objects/investment-horizon.vo";
import { Quantity } from "@/domain/portfolio/value-objects/quantity.vo";
import { StockSymbol } from "@/domain/portfolio/value-objects/symbol.vo";

export class AddHoldingUseCase
  implements UseCase<IAddHoldingInputDto, IAddHoldingOutputDto>
{
  constructor(
    private readonly portfolioRepo: IPortfolioRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async execute(
    input: IAddHoldingInputDto,
  ): Promise<Result<IAddHoldingOutputDto>> {
    const symbolResult = StockSymbol.create(input.symbol);
    const quantityResult = Quantity.create(input.quantity);
    const averagePriceResult = AveragePrice.create(input.averagePrice);
    const horizonResult = InvestmentHorizon.create(input.horizon);

    const combined = Result.combine([
      symbolResult,
      quantityResult,
      averagePriceResult,
      horizonResult,
    ]);
    if (combined.isFailure) return Result.fail(combined.getError());

    const duplicateCheck = await this.checkNoDuplicate(
      input.userId,
      input.symbol,
    );
    if (duplicateCheck.isFailure) return Result.fail(duplicateCheck.getError());

    const holding = PortfolioHolding.create({
      userId: input.userId,
      symbol: symbolResult.getValue(),
      quantity: quantityResult.getValue(),
      averagePrice: averagePriceResult.getValue(),
      horizon: horizonResult.getValue(),
    });

    const saveResult = await this.portfolioRepo.create(holding);
    if (saveResult.isFailure) return Result.fail(saveResult.getError());

    await this.eventDispatcher.dispatchAll(holding.domainEvents);
    holding.clearEvents();

    return Result.ok(this.toDto(holding));
  }

  private async checkNoDuplicate(
    userId: string,
    symbol: string,
  ): Promise<Result<void>> {
    const existsResult = await this.portfolioRepo.findByUserAndSymbol(
      userId,
      symbol.toUpperCase(),
    );
    if (existsResult.isFailure) return Result.fail(existsResult.getError());

    return match<PortfolioHolding, Result<void>>(existsResult.getValue(), {
      Some: () => Result.fail("Holding for this symbol already exists"),
      None: () => Result.ok(),
    });
  }

  private toDto(holding: PortfolioHolding): IAddHoldingOutputDto {
    return {
      id: String(holding.id.value),
      userId: holding.get("userId"),
      symbol: holding.get("symbol").value,
      quantity: holding.get("quantity").value,
      averagePrice: holding.get("averagePrice").value,
      horizon: holding.get("horizon").value,
      createdAt: holding.get("createdAt"),
    };
  }
}

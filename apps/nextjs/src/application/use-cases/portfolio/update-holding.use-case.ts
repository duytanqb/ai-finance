import { match, Result, type UseCase, UUID } from "@packages/ddd-kit";
import type {
  IUpdateHoldingInputDto,
  IUpdateHoldingOutputDto,
} from "@/application/dto/portfolio/update-holding.dto";
import type { IEventDispatcher } from "@/application/ports/event-dispatcher.port";
import type { IPortfolioRepository } from "@/application/ports/portfolio-repository.port";
import type { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";
import { PortfolioHoldingId } from "@/domain/portfolio/portfolio-holding-id";
import { AveragePrice } from "@/domain/portfolio/value-objects/average-price.vo";
import { InvestmentHorizon } from "@/domain/portfolio/value-objects/investment-horizon.vo";
import { Quantity } from "@/domain/portfolio/value-objects/quantity.vo";

export class UpdateHoldingUseCase
  implements UseCase<IUpdateHoldingInputDto, IUpdateHoldingOutputDto>
{
  constructor(
    private readonly portfolioRepo: IPortfolioRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async execute(
    input: IUpdateHoldingInputDto,
  ): Promise<Result<IUpdateHoldingOutputDto>> {
    const holdingId = PortfolioHoldingId.create(new UUID(input.holdingId));

    const holdingResult = await this.findAndVerifyOwnership(
      holdingId,
      input.userId,
    );
    if (holdingResult.isFailure) return Result.fail(holdingResult.getError());

    const holding = holdingResult.getValue();

    if (input.quantity !== undefined || input.averagePrice !== undefined) {
      const quantity = input.quantity ?? holding.get("quantity").value;
      const avgPrice = input.averagePrice ?? holding.get("averagePrice").value;

      const quantityResult = Quantity.create(quantity);
      const avgPriceResult = AveragePrice.create(avgPrice);

      const combined = Result.combine([quantityResult, avgPriceResult]);
      if (combined.isFailure) return Result.fail(combined.getError());

      const updateResult = holding.updateQuantity(
        quantityResult.getValue(),
        avgPriceResult.getValue(),
      );
      if (updateResult.isFailure) return Result.fail(updateResult.getError());
    }

    if (input.horizon !== undefined) {
      const horizonResult = InvestmentHorizon.create(input.horizon);
      if (horizonResult.isFailure) return Result.fail(horizonResult.getError());

      const updateResult = holding.updateHorizon(horizonResult.getValue());
      if (updateResult.isFailure) return Result.fail(updateResult.getError());
    }

    const saveResult = await this.portfolioRepo.update(holding);
    if (saveResult.isFailure) return Result.fail(saveResult.getError());

    await this.eventDispatcher.dispatchAll(holding.domainEvents);
    holding.clearEvents();

    return Result.ok(this.toDto(holding));
  }

  private async findAndVerifyOwnership(
    holdingId: PortfolioHoldingId,
    userId: string,
  ): Promise<Result<PortfolioHolding>> {
    const findResult = await this.portfolioRepo.findById(holdingId);
    if (findResult.isFailure) return Result.fail(findResult.getError());

    return match<PortfolioHolding, Result<PortfolioHolding>>(
      findResult.getValue(),
      {
        Some: (holding) => {
          if (holding.get("userId") !== userId) {
            return Result.fail("Not authorized to update this holding");
          }
          return Result.ok(holding);
        },
        None: () => Result.fail("Holding not found"),
      },
    );
  }

  private toDto(holding: PortfolioHolding): IUpdateHoldingOutputDto {
    return {
      id: String(holding.id.value),
      userId: holding.get("userId"),
      symbol: holding.get("symbol").value,
      quantity: holding.get("quantity").value,
      averagePrice: holding.get("averagePrice").value,
      horizon: holding.get("horizon").value,
      updatedAt: holding._props.updatedAt,
    };
  }
}

import { match, Result, type UseCase, UUID } from "@packages/ddd-kit";
import type {
  IRemoveHoldingInputDto,
  IRemoveHoldingOutputDto,
} from "@/application/dto/portfolio/remove-holding.dto";
import type { IEventDispatcher } from "@/application/ports/event-dispatcher.port";
import type { IPortfolioRepository } from "@/application/ports/portfolio-repository.port";
import { HoldingRemovedEvent } from "@/domain/portfolio/events/holding-removed.event";
import type { PortfolioHolding } from "@/domain/portfolio/portfolio-holding.aggregate";
import { PortfolioHoldingId } from "@/domain/portfolio/portfolio-holding-id";

export class RemoveHoldingUseCase
  implements UseCase<IRemoveHoldingInputDto, IRemoveHoldingOutputDto>
{
  constructor(
    private readonly portfolioRepo: IPortfolioRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async execute(
    input: IRemoveHoldingInputDto,
  ): Promise<Result<IRemoveHoldingOutputDto>> {
    const holdingId = PortfolioHoldingId.create(new UUID(input.holdingId));

    const holdingResult = await this.findAndVerifyOwnership(
      holdingId,
      input.userId,
    );
    if (holdingResult.isFailure) return Result.fail(holdingResult.getError());

    const holding = holdingResult.getValue();

    const deleteResult = await this.portfolioRepo.delete(holdingId);
    if (deleteResult.isFailure) return Result.fail(deleteResult.getError());

    const event = new HoldingRemovedEvent(
      String(holding.id.value),
      holding.get("userId"),
      holding.get("symbol").value,
    );
    await this.eventDispatcher.dispatch(event);

    return Result.ok({ id: String(holding.id.value) });
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
            return Result.fail("Not authorized to remove this holding");
          }
          return Result.ok(holding);
        },
        None: () => Result.fail("Holding not found"),
      },
    );
  }
}

import { match, Option, Result, type UseCase } from "@packages/ddd-kit";
import type {
  IAddToWatchlistInputDto,
  IAddToWatchlistOutputDto,
} from "@/application/dto/watchlist/add-to-watchlist.dto";
import type { IEventDispatcher } from "@/application/ports/event-dispatcher.port";
import type { IWatchlistRepository } from "@/application/ports/watchlist-repository.port";
import { StockSymbol } from "@/domain/portfolio/value-objects/symbol.vo";
import { Notes } from "@/domain/watchlist/value-objects/notes.vo";
import { TargetPrice } from "@/domain/watchlist/value-objects/target-price.vo";
import { WatchlistItem } from "@/domain/watchlist/watchlist-item.aggregate";

export class AddToWatchlistUseCase
  implements UseCase<IAddToWatchlistInputDto, IAddToWatchlistOutputDto>
{
  constructor(
    private readonly watchlistRepo: IWatchlistRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async execute(
    input: IAddToWatchlistInputDto,
  ): Promise<Result<IAddToWatchlistOutputDto>> {
    const symbolResult = StockSymbol.create(input.symbol);
    if (symbolResult.isFailure) return Result.fail(symbolResult.getError());

    let targetPriceOption: Option<TargetPrice> = Option.none();
    if (input.targetPrice !== undefined) {
      const targetPriceResult = TargetPrice.create(input.targetPrice);
      if (targetPriceResult.isFailure)
        return Result.fail(targetPriceResult.getError());
      targetPriceOption = Option.some(targetPriceResult.getValue());
    }

    let notesOption: Option<Notes> = Option.none();
    if (input.notes !== undefined) {
      const notesResult = Notes.create(input.notes);
      if (notesResult.isFailure) return Result.fail(notesResult.getError());
      notesOption = Option.some(notesResult.getValue());
    }

    const duplicateCheck = await this.checkNoDuplicate(
      input.userId,
      input.symbol,
    );
    if (duplicateCheck.isFailure) return Result.fail(duplicateCheck.getError());

    const item = WatchlistItem.create({
      userId: input.userId,
      symbol: symbolResult.getValue(),
      targetPrice: targetPriceOption,
      notes: notesOption,
    });

    const saveResult = await this.watchlistRepo.create(item);
    if (saveResult.isFailure) return Result.fail(saveResult.getError());

    await this.eventDispatcher.dispatchAll(item.domainEvents);
    item.clearEvents();

    return Result.ok(this.toDto(item));
  }

  private async checkNoDuplicate(
    userId: string,
    symbol: string,
  ): Promise<Result<void>> {
    const existsResult = await this.watchlistRepo.findByUserAndSymbol(
      userId,
      symbol.toUpperCase(),
    );
    if (existsResult.isFailure) return Result.fail(existsResult.getError());

    return match<WatchlistItem, Result<void>>(existsResult.getValue(), {
      Some: () => Result.fail("Symbol already in watchlist"),
      None: () => Result.ok(),
    });
  }

  private toDto(item: WatchlistItem): IAddToWatchlistOutputDto {
    return {
      id: String(item.id.value),
      userId: item.get("userId"),
      symbol: item.get("symbol").value,
      targetPrice: item.get("targetPrice").toNull()?.value ?? null,
      notes: item.get("notes").toNull()?.value ?? null,
      createdAt: item.get("createdAt"),
    };
  }
}

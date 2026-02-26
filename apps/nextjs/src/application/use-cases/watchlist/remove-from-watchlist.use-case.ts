import { match, Result, type UseCase, UUID } from "@packages/ddd-kit";
import type {
  IRemoveFromWatchlistInputDto,
  IRemoveFromWatchlistOutputDto,
} from "@/application/dto/watchlist/remove-from-watchlist.dto";
import type { IEventDispatcher } from "@/application/ports/event-dispatcher.port";
import type { IWatchlistRepository } from "@/application/ports/watchlist-repository.port";
import { ItemRemovedEvent } from "@/domain/watchlist/events/item-removed.event";
import type { WatchlistItem } from "@/domain/watchlist/watchlist-item.aggregate";
import { WatchlistItemId } from "@/domain/watchlist/watchlist-item-id";

export class RemoveFromWatchlistUseCase
  implements
    UseCase<IRemoveFromWatchlistInputDto, IRemoveFromWatchlistOutputDto>
{
  constructor(
    private readonly watchlistRepo: IWatchlistRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async execute(
    input: IRemoveFromWatchlistInputDto,
  ): Promise<Result<IRemoveFromWatchlistOutputDto>> {
    const itemId = WatchlistItemId.create(new UUID(input.itemId));

    const itemResult = await this.findAndVerifyOwnership(itemId, input.userId);
    if (itemResult.isFailure) return Result.fail(itemResult.getError());

    const item = itemResult.getValue();

    const deleteResult = await this.watchlistRepo.delete(itemId);
    if (deleteResult.isFailure) return Result.fail(deleteResult.getError());

    const event = new ItemRemovedEvent(
      String(item.id.value),
      item.get("userId"),
      item.get("symbol").value,
    );
    await this.eventDispatcher.dispatch(event);

    return Result.ok({ id: String(item.id.value) });
  }

  private async findAndVerifyOwnership(
    itemId: WatchlistItemId,
    userId: string,
  ): Promise<Result<WatchlistItem>> {
    const findResult = await this.watchlistRepo.findById(itemId);
    if (findResult.isFailure) return Result.fail(findResult.getError());

    return match<WatchlistItem, Result<WatchlistItem>>(findResult.getValue(), {
      Some: (item) => {
        if (item.get("userId") !== userId) {
          return Result.fail("Not authorized to remove this watchlist item");
        }
        return Result.ok(item);
      },
      None: () => Result.fail("Watchlist item not found"),
    });
  }
}

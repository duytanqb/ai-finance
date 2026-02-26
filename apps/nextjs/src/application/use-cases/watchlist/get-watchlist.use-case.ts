import { Result, type UseCase } from "@packages/ddd-kit";
import type {
  IGetWatchlistInputDto,
  IGetWatchlistOutputDto,
  IWatchlistItemDto,
} from "@/application/dto/watchlist/get-watchlist.dto";
import type { IWatchlistRepository } from "@/application/ports/watchlist-repository.port";
import type { WatchlistItem } from "@/domain/watchlist/watchlist-item.aggregate";

export class GetWatchlistUseCase
  implements UseCase<IGetWatchlistInputDto, IGetWatchlistOutputDto>
{
  constructor(private readonly watchlistRepo: IWatchlistRepository) {}

  async execute(
    input: IGetWatchlistInputDto,
  ): Promise<Result<IGetWatchlistOutputDto>> {
    const result = await this.watchlistRepo.findByUserId(input.userId);
    if (result.isFailure) return Result.fail(result.getError());

    const paginatedResult = result.getValue();

    return Result.ok({
      items: paginatedResult.data.map(this.toDto),
      totalItems: paginatedResult.pagination.total,
    });
  }

  private toDto(item: WatchlistItem): IWatchlistItemDto {
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

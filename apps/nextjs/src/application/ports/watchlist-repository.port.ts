import type {
  BaseRepository,
  Option,
  PaginatedResult,
  Result,
} from "@packages/ddd-kit";
import type { WatchlistItem } from "@/domain/watchlist/watchlist-item.aggregate";
import type { WatchlistItemId } from "@/domain/watchlist/watchlist-item-id";

export interface IWatchlistRepository extends BaseRepository<WatchlistItem> {
  findById(id: WatchlistItemId): Promise<Result<Option<WatchlistItem>>>;
  findByUserId(userId: string): Promise<Result<PaginatedResult<WatchlistItem>>>;
  findByUserAndSymbol(
    userId: string,
    symbol: string,
  ): Promise<Result<Option<WatchlistItem>>>;
}

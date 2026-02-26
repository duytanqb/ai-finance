import { createModule } from "@evyweb/ioctopus";
import { DrizzleWatchlistRepository } from "@/adapters/repositories/watchlist.repository";
import { AddToWatchlistUseCase } from "@/application/use-cases/watchlist/add-to-watchlist.use-case";
import { GetWatchlistUseCase } from "@/application/use-cases/watchlist/get-watchlist.use-case";
import { RemoveFromWatchlistUseCase } from "@/application/use-cases/watchlist/remove-from-watchlist.use-case";
import { DI_SYMBOLS } from "../types";

export const createWatchlistModule = () => {
  const watchlistModule = createModule();

  watchlistModule
    .bind(DI_SYMBOLS.IWatchlistRepository)
    .toClass(DrizzleWatchlistRepository);

  watchlistModule
    .bind(DI_SYMBOLS.AddToWatchlistUseCase)
    .toClass(AddToWatchlistUseCase, [
      DI_SYMBOLS.IWatchlistRepository,
      DI_SYMBOLS.IEventDispatcher,
    ]);

  watchlistModule
    .bind(DI_SYMBOLS.RemoveFromWatchlistUseCase)
    .toClass(RemoveFromWatchlistUseCase, [
      DI_SYMBOLS.IWatchlistRepository,
      DI_SYMBOLS.IEventDispatcher,
    ]);

  watchlistModule
    .bind(DI_SYMBOLS.GetWatchlistUseCase)
    .toClass(GetWatchlistUseCase, [DI_SYMBOLS.IWatchlistRepository]);

  return watchlistModule;
};

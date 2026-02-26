import { createModule } from "@evyweb/ioctopus";
import { DrizzlePortfolioRepository } from "@/adapters/repositories/portfolio.repository";
import { AddHoldingUseCase } from "@/application/use-cases/portfolio/add-holding.use-case";
import { GetPortfolioUseCase } from "@/application/use-cases/portfolio/get-portfolio.use-case";
import { RemoveHoldingUseCase } from "@/application/use-cases/portfolio/remove-holding.use-case";
import { UpdateHoldingUseCase } from "@/application/use-cases/portfolio/update-holding.use-case";
import { DI_SYMBOLS } from "../types";

export const createPortfolioModule = () => {
  const portfolioModule = createModule();

  portfolioModule
    .bind(DI_SYMBOLS.IPortfolioRepository)
    .toClass(DrizzlePortfolioRepository);

  portfolioModule
    .bind(DI_SYMBOLS.AddHoldingUseCase)
    .toClass(AddHoldingUseCase, [
      DI_SYMBOLS.IPortfolioRepository,
      DI_SYMBOLS.IEventDispatcher,
    ]);

  portfolioModule
    .bind(DI_SYMBOLS.RemoveHoldingUseCase)
    .toClass(RemoveHoldingUseCase, [
      DI_SYMBOLS.IPortfolioRepository,
      DI_SYMBOLS.IEventDispatcher,
    ]);

  portfolioModule
    .bind(DI_SYMBOLS.UpdateHoldingUseCase)
    .toClass(UpdateHoldingUseCase, [
      DI_SYMBOLS.IPortfolioRepository,
      DI_SYMBOLS.IEventDispatcher,
    ]);

  portfolioModule
    .bind(DI_SYMBOLS.GetPortfolioUseCase)
    .toClass(GetPortfolioUseCase, [DI_SYMBOLS.IPortfolioRepository]);

  return portfolioModule;
};

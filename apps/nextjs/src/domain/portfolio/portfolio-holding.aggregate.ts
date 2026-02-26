import { Aggregate, Result, UUID } from "@packages/ddd-kit";
import { HoldingAddedEvent } from "./events/holding-added.event";
import { HoldingUpdatedEvent } from "./events/holding-updated.event";
import { PortfolioHoldingId } from "./portfolio-holding-id";
import type { AveragePrice } from "./value-objects/average-price.vo";
import type { InvestmentHorizon } from "./value-objects/investment-horizon.vo";
import type { Quantity } from "./value-objects/quantity.vo";
import type { StockSymbol } from "./value-objects/symbol.vo";

export interface IPortfolioHoldingProps {
  userId: string;
  symbol: StockSymbol;
  quantity: Quantity;
  averagePrice: AveragePrice;
  horizon: InvestmentHorizon;
  createdAt: Date;
  updatedAt?: Date;
}

export class PortfolioHolding extends Aggregate<IPortfolioHoldingProps> {
  private constructor(
    props: IPortfolioHoldingProps,
    id?: UUID<string | number>,
  ) {
    super(props, id);
  }

  get id(): PortfolioHoldingId {
    return PortfolioHoldingId.create(this._id);
  }

  static create(
    props: Omit<IPortfolioHoldingProps, "createdAt" | "updatedAt">,
    id?: UUID<string | number>,
  ): PortfolioHolding {
    const newId = id ?? new UUID<string>();
    const holding = new PortfolioHolding(
      {
        ...props,
        createdAt: new Date(),
        updatedAt: undefined,
      },
      newId,
    );

    holding.addEvent(
      new HoldingAddedEvent(
        String(newId.value),
        props.userId,
        props.symbol.value,
        props.quantity.value,
        props.averagePrice.value,
        props.horizon.value,
      ),
    );

    return holding;
  }

  static reconstitute(
    props: IPortfolioHoldingProps,
    id: PortfolioHoldingId,
  ): PortfolioHolding {
    return new PortfolioHolding(props, id);
  }

  updateQuantity(quantity: Quantity, averagePrice: AveragePrice): Result<void> {
    this._props.quantity = quantity;
    this._props.averagePrice = averagePrice;
    this._props.updatedAt = new Date();

    this.addEvent(
      new HoldingUpdatedEvent(
        String(this.id.value),
        this.get("userId"),
        this.get("symbol").value,
        quantity.value,
        this.get("horizon").value,
      ),
    );

    return Result.ok();
  }

  updateHorizon(horizon: InvestmentHorizon): Result<void> {
    this._props.horizon = horizon;
    this._props.updatedAt = new Date();

    this.addEvent(
      new HoldingUpdatedEvent(
        String(this.id.value),
        this.get("userId"),
        this.get("symbol").value,
        this.get("quantity").value,
        horizon.value,
      ),
    );

    return Result.ok();
  }
}

import { BaseDomainEvent } from "@packages/ddd-kit";

interface HoldingAddedPayload {
  holdingId: string;
  userId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  horizon: string;
}

export class HoldingAddedEvent extends BaseDomainEvent<HoldingAddedPayload> {
  readonly eventType = "portfolio.holding_added";
  readonly aggregateId: string;
  readonly payload: HoldingAddedPayload;

  constructor(
    holdingId: string,
    userId: string,
    symbol: string,
    quantity: number,
    averagePrice: number,
    horizon: string,
  ) {
    super();
    this.aggregateId = holdingId;
    this.payload = {
      holdingId,
      userId,
      symbol,
      quantity,
      averagePrice,
      horizon,
    };
  }
}

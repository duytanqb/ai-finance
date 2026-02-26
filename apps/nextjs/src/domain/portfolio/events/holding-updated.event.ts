import { BaseDomainEvent } from "@packages/ddd-kit";

interface HoldingUpdatedPayload {
  holdingId: string;
  userId: string;
  symbol: string;
  quantity: number;
  horizon: string;
}

export class HoldingUpdatedEvent extends BaseDomainEvent<HoldingUpdatedPayload> {
  readonly eventType = "portfolio.holding_updated";
  readonly aggregateId: string;
  readonly payload: HoldingUpdatedPayload;

  constructor(
    holdingId: string,
    userId: string,
    symbol: string,
    quantity: number,
    horizon: string,
  ) {
    super();
    this.aggregateId = holdingId;
    this.payload = { holdingId, userId, symbol, quantity, horizon };
  }
}

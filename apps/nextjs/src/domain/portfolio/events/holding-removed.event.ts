import { BaseDomainEvent } from "@packages/ddd-kit";

interface HoldingRemovedPayload {
  holdingId: string;
  userId: string;
  symbol: string;
}

export class HoldingRemovedEvent extends BaseDomainEvent<HoldingRemovedPayload> {
  readonly eventType = "portfolio.holding_removed";
  readonly aggregateId: string;
  readonly payload: HoldingRemovedPayload;

  constructor(holdingId: string, userId: string, symbol: string) {
    super();
    this.aggregateId = holdingId;
    this.payload = { holdingId, userId, symbol };
  }
}

import { BaseDomainEvent } from "@packages/ddd-kit";

interface ItemAddedPayload {
  itemId: string;
  userId: string;
  symbol: string;
}

export class ItemAddedEvent extends BaseDomainEvent<ItemAddedPayload> {
  readonly eventType = "watchlist.item_added";
  readonly aggregateId: string;
  readonly payload: ItemAddedPayload;

  constructor(itemId: string, userId: string, symbol: string) {
    super();
    this.aggregateId = itemId;
    this.payload = { itemId, userId, symbol };
  }
}

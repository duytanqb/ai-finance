import { BaseDomainEvent } from "@packages/ddd-kit";

interface ItemRemovedPayload {
  itemId: string;
  userId: string;
  symbol: string;
}

export class ItemRemovedEvent extends BaseDomainEvent<ItemRemovedPayload> {
  readonly eventType = "watchlist.item_removed";
  readonly aggregateId: string;
  readonly payload: ItemRemovedPayload;

  constructor(itemId: string, userId: string, symbol: string) {
    super();
    this.aggregateId = itemId;
    this.payload = { itemId, userId, symbol };
  }
}

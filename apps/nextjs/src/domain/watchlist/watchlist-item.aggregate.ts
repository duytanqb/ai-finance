import { Aggregate, type Option, UUID } from "@packages/ddd-kit";
import type { StockSymbol } from "../portfolio/value-objects/symbol.vo";
import { ItemAddedEvent } from "./events/item-added.event";
import type { Notes } from "./value-objects/notes.vo";
import type { TargetPrice } from "./value-objects/target-price.vo";
import { WatchlistItemId } from "./watchlist-item-id";

export interface IWatchlistItemProps {
  userId: string;
  symbol: StockSymbol;
  targetPrice: Option<TargetPrice>;
  notes: Option<Notes>;
  createdAt: Date;
}

export class WatchlistItem extends Aggregate<IWatchlistItemProps> {
  private constructor(props: IWatchlistItemProps, id?: UUID<string | number>) {
    super(props, id);
  }

  get id(): WatchlistItemId {
    return WatchlistItemId.create(this._id);
  }

  static create(
    props: Omit<IWatchlistItemProps, "createdAt">,
    id?: UUID<string | number>,
  ): WatchlistItem {
    const newId = id ?? new UUID<string>();
    const item = new WatchlistItem(
      {
        ...props,
        createdAt: new Date(),
      },
      newId,
    );

    item.addEvent(
      new ItemAddedEvent(String(newId.value), props.userId, props.symbol.value),
    );

    return item;
  }

  static reconstitute(
    props: IWatchlistItemProps,
    id: WatchlistItemId,
  ): WatchlistItem {
    return new WatchlistItem(props, id);
  }
}

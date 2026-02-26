import { UUID } from "@packages/ddd-kit";

export class WatchlistItemId extends UUID<string | number> {
  protected [Symbol.toStringTag] = "WatchlistItemId";

  private constructor(id: UUID<string | number>) {
    super(id ? id.value : new UUID<string | number>().value);
  }

  static create(id: UUID<string | number>): WatchlistItemId {
    return new WatchlistItemId(id);
  }
}

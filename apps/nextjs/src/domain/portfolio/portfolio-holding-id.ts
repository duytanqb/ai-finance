import { UUID } from "@packages/ddd-kit";

export class PortfolioHoldingId extends UUID<string | number> {
  protected [Symbol.toStringTag] = "PortfolioHoldingId";

  private constructor(id: UUID<string | number>) {
    super(id ? id.value : new UUID<string | number>().value);
  }

  static create(id: UUID<string | number>): PortfolioHoldingId {
    return new PortfolioHoldingId(id);
  }
}

import { Result, ValueObject } from "@packages/ddd-kit";
import { z } from "zod";

export const INVESTMENT_HORIZONS = [
  "short-term",
  "medium-term",
  "long-term",
  "hold-forever",
] as const;

export type InvestmentHorizonType = (typeof INVESTMENT_HORIZONS)[number];

const investmentHorizonSchema = z.enum(INVESTMENT_HORIZONS, {
  error:
    "Horizon must be one of: short-term, medium-term, long-term, hold-forever",
});

export class InvestmentHorizon extends ValueObject<InvestmentHorizonType> {
  protected validate(
    value: InvestmentHorizonType,
  ): Result<InvestmentHorizonType> {
    const result = investmentHorizonSchema.safeParse(value);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return Result.fail(firstIssue?.message ?? "Invalid investment horizon");
    }

    return Result.ok(result.data);
  }
}

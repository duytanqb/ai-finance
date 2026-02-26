import { Result, ValueObject } from "@packages/ddd-kit";
import { z } from "zod";

const symbolSchema = z
  .string()
  .min(1, "Symbol is required")
  .max(10, "Symbol must be less than 10 characters")
  .transform((v) => v.toUpperCase().trim());

export class StockSymbol extends ValueObject<string> {
  protected validate(value: string): Result<string> {
    const result = symbolSchema.safeParse(value);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return Result.fail(firstIssue?.message ?? "Invalid symbol");
    }

    return Result.ok(result.data);
  }
}

import { Result, ValueObject } from "@packages/ddd-kit";
import { z } from "zod";

const averagePriceSchema = z
  .number()
  .positive("Average price must be positive");

export class AveragePrice extends ValueObject<number> {
  protected validate(value: number): Result<number> {
    const result = averagePriceSchema.safeParse(value);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return Result.fail(firstIssue?.message ?? "Invalid average price");
    }

    return Result.ok(result.data);
  }
}

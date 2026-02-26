import { Result, ValueObject } from "@packages/ddd-kit";
import { z } from "zod";

const targetPriceSchema = z.number().positive("Target price must be positive");

export class TargetPrice extends ValueObject<number> {
  protected validate(value: number): Result<number> {
    const result = targetPriceSchema.safeParse(value);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return Result.fail(firstIssue?.message ?? "Invalid target price");
    }

    return Result.ok(result.data);
  }
}

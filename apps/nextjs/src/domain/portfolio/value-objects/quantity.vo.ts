import { Result, ValueObject } from "@packages/ddd-kit";
import { z } from "zod";

const quantitySchema = z.number().positive("Quantity must be positive");

export class Quantity extends ValueObject<number> {
  protected validate(value: number): Result<number> {
    const result = quantitySchema.safeParse(value);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return Result.fail(firstIssue?.message ?? "Invalid quantity");
    }

    return Result.ok(result.data);
  }
}

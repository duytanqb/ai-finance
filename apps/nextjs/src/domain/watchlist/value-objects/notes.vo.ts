import { Result, ValueObject } from "@packages/ddd-kit";
import { z } from "zod";

const notesSchema = z
  .string()
  .max(500, "Notes must be less than 500 characters")
  .transform((v) => v.trim());

export class Notes extends ValueObject<string> {
  protected validate(value: string): Result<string> {
    const result = notesSchema.safeParse(value);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return Result.fail(firstIssue?.message ?? "Invalid notes");
    }

    return Result.ok(result.data);
  }
}

import z from "zod";

export const updateHoldingInputDtoSchema = z.object({
  holdingId: z.string().min(1),
  userId: z.string().min(1),
  quantity: z.number().positive().optional(),
  averagePrice: z.number().positive().optional(),
  horizon: z
    .enum(["short-term", "medium-term", "long-term", "hold-forever"])
    .optional(),
});

export const updateHoldingOutputDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  horizon: z.string(),
  updatedAt: z.date().optional(),
});

export type IUpdateHoldingInputDto = z.infer<
  typeof updateHoldingInputDtoSchema
>;
export type IUpdateHoldingOutputDto = z.infer<
  typeof updateHoldingOutputDtoSchema
>;

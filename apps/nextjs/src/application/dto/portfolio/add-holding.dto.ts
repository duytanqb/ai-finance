import z from "zod";

export const addHoldingInputDtoSchema = z.object({
  userId: z.string().min(1),
  symbol: z.string().min(1).max(10),
  quantity: z.number().positive(),
  averagePrice: z.number().positive(),
  horizon: z.enum(["short-term", "medium-term", "long-term", "hold-forever"]),
});

export const addHoldingOutputDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  horizon: z.string(),
  createdAt: z.date(),
});

export type IAddHoldingInputDto = z.infer<typeof addHoldingInputDtoSchema>;
export type IAddHoldingOutputDto = z.infer<typeof addHoldingOutputDtoSchema>;

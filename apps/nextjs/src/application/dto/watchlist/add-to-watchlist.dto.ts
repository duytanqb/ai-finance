import z from "zod";

export const addToWatchlistInputDtoSchema = z.object({
  userId: z.string().min(1),
  symbol: z.string().min(1).max(10),
  targetPrice: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const addToWatchlistOutputDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  targetPrice: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
});

export type IAddToWatchlistInputDto = z.infer<
  typeof addToWatchlistInputDtoSchema
>;
export type IAddToWatchlistOutputDto = z.infer<
  typeof addToWatchlistOutputDtoSchema
>;

import z from "zod";

export const getWatchlistInputDtoSchema = z.object({
  userId: z.string().min(1),
});

export const watchlistItemDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  targetPrice: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
});

export const getWatchlistOutputDtoSchema = z.object({
  items: z.array(watchlistItemDtoSchema),
  totalItems: z.number(),
});

export type IGetWatchlistInputDto = z.infer<typeof getWatchlistInputDtoSchema>;
export type IGetWatchlistOutputDto = z.infer<
  typeof getWatchlistOutputDtoSchema
>;
export type IWatchlistItemDto = z.infer<typeof watchlistItemDtoSchema>;

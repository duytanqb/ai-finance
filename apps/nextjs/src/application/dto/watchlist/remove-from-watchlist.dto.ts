import z from "zod";

export const removeFromWatchlistInputDtoSchema = z.object({
  itemId: z.string().min(1),
  userId: z.string().min(1),
});

export const removeFromWatchlistOutputDtoSchema = z.object({
  id: z.string(),
});

export type IRemoveFromWatchlistInputDto = z.infer<
  typeof removeFromWatchlistInputDtoSchema
>;
export type IRemoveFromWatchlistOutputDto = z.infer<
  typeof removeFromWatchlistOutputDtoSchema
>;

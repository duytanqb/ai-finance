import z from "zod";

export const removeHoldingInputDtoSchema = z.object({
  holdingId: z.string().min(1),
  userId: z.string().min(1),
});

export const removeHoldingOutputDtoSchema = z.object({
  id: z.string(),
});

export type IRemoveHoldingInputDto = z.infer<
  typeof removeHoldingInputDtoSchema
>;
export type IRemoveHoldingOutputDto = z.infer<
  typeof removeHoldingOutputDtoSchema
>;

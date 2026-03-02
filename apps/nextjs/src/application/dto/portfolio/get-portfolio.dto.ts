import z from "zod";

export const getPortfolioInputDtoSchema = z.object({
  userId: z.string().min(1),
});

export const holdingDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  horizon: z.string(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const getPortfolioOutputDtoSchema = z.object({
  holdings: z.array(holdingDtoSchema),
  totalHoldings: z.number(),
});

export type IGetPortfolioInputDto = z.infer<typeof getPortfolioInputDtoSchema>;
export type IGetPortfolioOutputDto = z.infer<
  typeof getPortfolioOutputDtoSchema
>;
export type IHoldingDto = z.infer<typeof holdingDtoSchema>;

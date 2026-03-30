import { z } from "zod";

export const MarketDataParamsSchema = z.object({
  coin: z.enum(["akash-network", "akt"]).optional().default("akt").openapi({ example: "akt" })
});

export const MarketDataResponseSchema = z.object({
  price: z.number(),
  volume: z.number(),
  marketCap: z.number(),
  marketCapRank: z.number(),
  priceChange24h: z.number(),
  priceChangePercentage24: z.number()
});

export type MarketDataParams = z.infer<typeof MarketDataParamsSchema>;
export type MarketDataResponse = z.infer<typeof MarketDataResponseSchema>;

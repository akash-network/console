import { z } from "zod";

export const envSchema = z.object({
  PROVIDER_INVENTORY_API_URL: z.string().url()
});

export type BidScreeningConfig = z.infer<typeof envSchema>;

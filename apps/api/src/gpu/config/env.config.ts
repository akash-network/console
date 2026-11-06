import z from "zod";

export const envSchema = z.object({
  PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: z.number().default(3 * 60),
  PRICING_BOT_ADDRESS: z.string().default("akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf"),
  GPU_MARKET_PRICE_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  GPU_MARKET_PRICE_MIN_PROVIDERS: z.coerce.number().int().positive().default(3),
  GPU_MARKET_PRICE_MIN_SAMPLES: z.coerce.number().int().positive().default(5)
});

export type GpuConfig = z.infer<typeof envSchema>;

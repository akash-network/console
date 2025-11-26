import z from "zod";

export const envSchema = z.object({
  PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: z.number().default(3 * 60),
  PRICING_BOT_ADDRESS: z.string().default("akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf")
});

export type GpuConfig = z.infer<typeof envSchema>;

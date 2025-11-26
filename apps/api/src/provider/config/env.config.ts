import z from "zod";

export const envSchema = z.object({
  PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: z
    .number()
    .optional()
    .default(3 * 60)
});

export type ProviderConfig = z.infer<typeof envSchema>;

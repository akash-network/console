import { z } from "zod";

export const envSchema = z.object({
  HEALTHZ_TIMEOUT_SECONDS: z.number({ coerce: true }).optional().default(10)
});

export type HealthzConfig = z.infer<typeof envSchema>;

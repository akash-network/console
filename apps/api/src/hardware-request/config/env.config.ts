import { z } from "zod";

export const envSchema = z.object({
  HARDWARE_REQUEST_EMAIL: z.string().email().optional().default("support@akash.network"),
  HARDWARE_REQUEST_HOURLY_LIMIT: z.number({ coerce: true }).int().positive().optional().default(3),
  HARDWARE_REQUEST_DAILY_LIMIT: z.number({ coerce: true }).int().positive().optional().default(10)
});

export type HardwareRequestConfig = z.infer<typeof envSchema>;

import { z } from "zod";

function blankToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

function optionalUrl() {
  return z.preprocess(blankToUndefined, z.string().url().optional());
}

export const envSchema = z.object({
  HARDWARE_REQUEST_EMAIL: z.string().email().optional().default("support@akash.network"),
  HARDWARE_REQUEST_HOURLY_LIMIT: z.number({ coerce: true }).int().positive().optional().default(3),
  HARDWARE_REQUEST_DAILY_LIMIT: z.number({ coerce: true }).int().positive().optional().default(10),
  HARDWARE_REQUEST_SLACK_WEBHOOK_URL: optionalUrl(),
  AMPLITUDE_PROJECT_URL: optionalUrl(),
  CONSOLE_ADMIN_URL: optionalUrl()
});

export type HardwareRequestConfig = z.infer<typeof envSchema>;

import { z } from "zod";

const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json")
});

export const envConfig = envSchema.parse(process.env);

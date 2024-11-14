import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  FLUENTD_TAG: z.string().optional().default("pino"),
  FLUENTD_HOST: z.string().optional(),
  FLUENTD_PORT: z.number({ coerce: true }).optional().default(24224),
});

export const envConfig = envSchema.parse(process.env);
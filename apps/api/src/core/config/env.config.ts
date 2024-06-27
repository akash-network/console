import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  // TODO: make required once billing is in prod
  POSTGRES_DB_URI: z.string().optional()
});

export const envConfig = envSchema.parse(process.env);

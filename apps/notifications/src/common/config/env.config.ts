import { z } from "zod";

const envSchema = z.object({
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json")
});

export type CommonEnvConfig = z.infer<typeof envSchema>;

export const commonEnvConfig = envSchema.parse(process.env);

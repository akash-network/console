import { z } from "zod";

export const envSchema = z.object({
  REST_API_NODE_URL: z.string().url()
});

export const envConfig = envSchema.parse(process.env);

export type EnvConfig = z.infer<typeof envSchema>;

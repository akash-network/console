import { z } from "zod";

const envSchema = z.object({
  ANONYMOUS_USER_TOKEN_SECRET: z.string()
});

export const envConfig = envSchema.parse(process.env);

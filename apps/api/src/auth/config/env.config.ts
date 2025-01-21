import { z } from "zod";

export const envSchema = z.object({
  ANONYMOUS_USER_TOKEN_SECRET: z.string(),
  AUTH0_ISSUER: z.string(),
  AUTH0_CLIENT_ID: z.string(),
  AUTH0_SECRET: z.string()
});

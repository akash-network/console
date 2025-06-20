import { z } from "zod";

export const envSchema = z.object({
  ANONYMOUS_USER_TOKEN_SECRET: z.string(),
  AUTH0_M2M_DOMAIN: z.string(),
  AUTH0_M2M_CLIENT_ID: z.string(),
  AUTH0_M2M_SECRET: z.string()
});

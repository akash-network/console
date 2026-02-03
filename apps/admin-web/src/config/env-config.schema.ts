import { z } from "zod";

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_APP_VERSION: z.string().optional()
});

export const serverEnvSchema = z.object({
  AUTH0_SECRET: z.string(),
  AUTH0_BASE_URL: z.string().url(),
  AUTH0_ISSUER_BASE_URL: z.string().url(),
  AUTH0_CLIENT_ID: z.string(),
  AUTH0_CLIENT_SECRET: z.string(),
  AUTH0_AUDIENCE: z.string().optional(),
  ADMIN_API_URL: z.string().url().default("http://localhost:3010")
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export type ServerEnvConfig = z.infer<typeof serverEnvSchema>;

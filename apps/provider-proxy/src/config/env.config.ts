import { z } from "zod";

export const appConfigSchema = z.object({
  REST_API_NODE_URL: z.string().url(),
  PORT: z.number({ coerce: true }).min(0).default(3040).optional()
});

export type AppConfig = z.infer<typeof appConfigSchema>;

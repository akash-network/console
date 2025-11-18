import { z } from "zod";

export const appConfigSchema = z.object({
  REST_API_NODE_URL: z.string().url(),
  PORT: z.number().default(3040).optional()
});

export type AppConfig = z.infer<typeof appConfigSchema>;

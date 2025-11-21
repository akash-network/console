import { z } from "zod";

export const appConfigSchema = z.object({
  GRPC_NODE_URL: z.string().url(),
  PORT: z.number({ coerce: true }).min(0).default(3040).optional()
});

export type AppConfig = z.infer<typeof appConfigSchema>;

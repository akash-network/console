import { z } from 'zod';

export const globalEnvSchema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
  NOTIFICATIONS_POSTGRES_URL: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
  API_NODE_ENDPOINT: z.string(),
});

export type GlobalEnvConfig = z.infer<typeof globalEnvSchema>;

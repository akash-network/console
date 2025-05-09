import { z } from 'zod';

export const globalEnvSchema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
  NOTIFICATIONS_POSTGRES_URL: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
  API_NODE_ENDPOINT: z.string(),
  APP_NAME: z.string(),
  STD_OUT_LOG_FORMAT: z.enum(['json', 'pretty']).optional().default('json'),
});

export type GlobalEnvConfig = z.infer<typeof globalEnvSchema>;

export const globalEnv = globalEnvSchema.parse(process.env);

import { z } from 'zod';

export const globalEnvSchema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
  NOTIFICATIONS_POSTGRES_URL: z.string(),
});

export type GlobalEnvConfig = z.infer<typeof globalEnvSchema>;

import { z } from "zod";

export const schema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
  APP_NAME: z.string()
});

export type BrokerEnvConfig = z.infer<typeof schema>;

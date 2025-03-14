import { z } from 'zod';

import { createConfigService } from '@src/lib/env-config/env-config.factory';

const schema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;

export const { configService, ConfigServiceProvider } =
  createConfigService(schema);

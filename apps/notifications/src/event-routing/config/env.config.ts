import { z } from 'zod';

import { createConfigService } from '@src/lib/env-config/env-config.factory';

const schema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
});

export type EventRoutingEnvConfig = z.infer<typeof schema>;

export const { configService, ConfigServiceProvider } =
  createConfigService(schema);

import { registerAs } from '@nestjs/config';
import type { BackoffOptions } from 'exponential-backoff';

import type { ChainEventsEnvConfig } from './env.config';
import { envConfig } from './env.config';
import { pollingConfig } from './polling.config';

export type ChainEventsConfig = ChainEventsEnvConfig & {
  pollingConfig: BackoffOptions;
};
export default registerAs('chain-events', () => ({
  ...envConfig,
  pollingConfig,
}));

import { registerAs } from '@nestjs/config';

import type { Namespaced } from '@src/lib/types/namespaced-config.type';
import type { NotificationEnvConfig } from './env.config';
import { envConfig } from './env.config';

const NAMESPACE = 'notifications' as const;

export type NotificationsConfig = Namespaced<
  typeof NAMESPACE,
  NotificationEnvConfig
>;

export default registerAs(NAMESPACE, () => ({
  ...envConfig,
}));

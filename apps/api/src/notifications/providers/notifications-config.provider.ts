import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

import type { NotificationsConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const NOTIFICATIONS_CONFIG: InjectionToken<NotificationsConfig> = Symbol("NOTIFICATIONS_CONFIG");

container.register(NOTIFICATIONS_CONFIG, {
  useFactory: () => envSchema.parse(process.env)
});

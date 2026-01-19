import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { AdminConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";
import { RAW_APP_CONFIG } from "./raw-app-config.provider";

export const ADMIN_CONFIG: InjectionToken<AdminConfig> = Symbol("ADMIN_CONFIG");

container.register(ADMIN_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { AdminConfig };

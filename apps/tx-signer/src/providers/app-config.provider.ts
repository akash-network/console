import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { envSchema } from "@src/config/env.config";
import { RAW_APP_CONFIG } from "@src/providers/raw-app-config.provider";

export const APP_CONFIG: InjectionToken<EnvConfig> = Symbol("APP_CONFIG");

container.register(APP_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { EnvConfig };

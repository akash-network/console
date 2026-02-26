import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { HealthzConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const HEALTHZ_CONFIG: InjectionToken<HealthzConfig> = Symbol("HEALTHZ_CONFIG");

container.register(HEALTHZ_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { HealthzConfig };

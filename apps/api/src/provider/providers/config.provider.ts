import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { ProviderConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const PROVIDER_CONFIG: InjectionToken<ProviderConfig> = Symbol("PROVIDER_CONFIG");

container.register(PROVIDER_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { ProviderConfig };

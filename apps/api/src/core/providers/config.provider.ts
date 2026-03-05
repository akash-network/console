import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { CoreConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";
import { RAW_APP_CONFIG } from "./raw-app-config.provider";

export const CORE_CONFIG: InjectionToken<CoreConfig> = Symbol("CORE_CONFIG");

container.register(CORE_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { CoreConfig };

import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { CoreConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const CORE_CONFIG: InjectionToken<CoreConfig> = "CORE_CONFIG";

container.register(CORE_CONFIG, {
  useFactory: instancePerContainerCachingFactory(() => envSchema.parse(process.env))
});

export type { CoreConfig };

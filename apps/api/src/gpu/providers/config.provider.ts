import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { GpuConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const GPU_CONFIG: InjectionToken<GpuConfig> = Symbol("GPU_CONFIG");

container.register(GPU_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { GpuConfig };

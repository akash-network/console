import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type GpuWaitlistConfig } from "../config/env.config";

export const GPU_WAITLIST_CONFIG = Symbol("GPU_WAITLIST_CONFIG") as InjectionToken<GpuWaitlistConfig>;
container.register(GPU_WAITLIST_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { GpuWaitlistConfig };

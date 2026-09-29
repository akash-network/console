import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type HardwareRequestConfig } from "../config/env.config";

export const HARDWARE_REQUEST_CONFIG = Symbol("HARDWARE_REQUEST_CONFIG") as InjectionToken<HardwareRequestConfig>;
container.register(HARDWARE_REQUEST_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { HardwareRequestConfig };

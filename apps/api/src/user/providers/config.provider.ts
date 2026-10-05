import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type UserConfig } from "../config/env.config";

export const USER_CONFIG = Symbol("USER_CONFIG") as InjectionToken<UserConfig>;
container.register(USER_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { UserConfig };

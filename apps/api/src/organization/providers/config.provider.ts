import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { envSchema, type OrganizationConfig } from "../config/env.config";

export const ORGANIZATION_CONFIG = Symbol("ORGANIZATION_CONFIG") as InjectionToken<OrganizationConfig>;
container.register(ORGANIZATION_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
export type { OrganizationConfig };

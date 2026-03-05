import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { DashboardConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const DASHBOARD_CONFIG: InjectionToken<DashboardConfig> = Symbol("DASHBOARD_CONFIG");

container.register(DASHBOARD_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { DashboardConfig };

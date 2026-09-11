import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { WorkloadAbuseConfig } from "./env.config";
import { envSchema } from "./env.config";

export const WORKLOAD_ABUSE_CONFIG: InjectionToken<WorkloadAbuseConfig> = Symbol("WORKLOAD_ABUSE_CONFIG");

container.register(WORKLOAD_ABUSE_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export const InjectWorkloadAbuseConfig = () => inject(WORKLOAD_ABUSE_CONFIG);

export type { WorkloadAbuseConfig };

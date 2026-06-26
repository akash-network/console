import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { ConfidentialComputeConfig } from "../config/env.config";
import { envSchema } from "../config/env.config";

export const CONFIDENTIAL_COMPUTE_CONFIG: InjectionToken<ConfidentialComputeConfig> = Symbol("CONFIDENTIAL_COMPUTE_CONFIG");

container.register(CONFIDENTIAL_COMPUTE_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export type { ConfidentialComputeConfig };

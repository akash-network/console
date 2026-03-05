import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import type { DeploymentConfig } from "./env.config";
import { envSchema } from "./env.config";

export const DEPLOYMENT_CONFIG: InjectionToken<DeploymentConfig> = Symbol("DEPLOYMENT_CONFIG");

container.register(DEPLOYMENT_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

export const InjectDeploymentConfig = () => inject(DEPLOYMENT_CONFIG);

export type { DeploymentConfig };

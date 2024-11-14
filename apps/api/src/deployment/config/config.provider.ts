import { container, inject } from "tsyringe";

import { config } from "@src/deployment/config";

export const DEPLOYMENT_CONFIG = "DEPLOYMENT_CONFIG";

container.register(DEPLOYMENT_CONFIG, { useValue: config });

export type DeploymentConfig = typeof config;

export const InjectDeploymentConfig = () => inject(DEPLOYMENT_CONFIG);

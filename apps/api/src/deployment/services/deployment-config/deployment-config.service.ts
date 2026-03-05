import { inject, singleton } from "tsyringe";

import { ConfigService } from "@src/core/services/config/config.service";
import { DEPLOYMENT_CONFIG } from "@src/deployment/config/config.provider";
import type { DeploymentConfig } from "@src/deployment/config/env.config";
import { envSchema } from "@src/deployment/config/env.config";

@singleton()
export class DeploymentConfigService extends ConfigService<typeof envSchema> {
  constructor(@inject(DEPLOYMENT_CONFIG) config: DeploymentConfig) {
    super({ config });
  }
}

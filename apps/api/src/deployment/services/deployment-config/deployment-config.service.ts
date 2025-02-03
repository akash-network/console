import { singleton } from "tsyringe";

import { ConfigService } from "@src/core/services/config/config.service";
import { envSchema } from "@src/deployment/config/env.config";

@singleton()
export class DeploymentConfigService extends ConfigService<typeof envSchema, unknown> {
  constructor() {
    super({ envSchema });
  }
}

import { singleton } from "tsyringe";

import { envSchema } from "@src/core/config/env.config";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class CoreConfigService extends ConfigService<typeof envSchema, unknown> {
  constructor() {
    super({ envSchema });
  }
}

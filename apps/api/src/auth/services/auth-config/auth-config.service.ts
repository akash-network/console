import { singleton } from "tsyringe";

import { envSchema } from "@src/auth/config/env.config";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class AuthConfigService extends ConfigService<typeof envSchema, unknown> {
  constructor() {
    super({ envSchema });
  }
}

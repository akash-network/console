import { singleton } from "tsyringe";

import { ConfigService } from "@src/core/services/config/config.service";
import { envSchema } from "@src/user/config/env.config";

@singleton()
export class UserConfigService extends ConfigService<typeof envSchema, unknown> {
  constructor() {
    super({ envSchema });
  }
}

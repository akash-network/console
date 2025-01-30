import { singleton } from "tsyringe";

import { envSchema } from "@src/chain/config/env.config";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class ChainConfigService extends ConfigService<typeof envSchema, unknown> {
  constructor() {
    super({ envSchema });
  }
}

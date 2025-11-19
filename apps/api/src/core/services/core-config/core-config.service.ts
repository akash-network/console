import { inject, singleton } from "tsyringe";

import { CoreConfig, envSchema } from "../../config/env.config";
import { CORE_CONFIG } from "../../providers/config.provider";
import { ConfigService } from "../config/config.service";

@singleton()
export class CoreConfigService extends ConfigService<typeof envSchema> {
  constructor(@inject(CORE_CONFIG) config: CoreConfig) {
    super({ config });
  }
}

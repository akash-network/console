import { inject, singleton } from "tsyringe";

import type { EnvConfig, envSchema } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { ConfigService } from "@src/services/config/config.service";

@singleton()
export class AppConfigService extends ConfigService<typeof envSchema> {
  constructor(@inject(APP_CONFIG) config: EnvConfig) {
    super({ config });
  }
}

import { inject, singleton } from "tsyringe";

import { envSchema } from "@src/auth/config/env.config";
import type { RawAppConfig } from "@src/core/providers/raw-app-config.provider";
import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class AuthConfigService extends ConfigService<typeof envSchema> {
  constructor(@inject(RAW_APP_CONFIG) appConfig: RawAppConfig) {
    super({ config: envSchema.parse(appConfig) });
  }
}

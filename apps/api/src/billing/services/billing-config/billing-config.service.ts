import { singleton } from "tsyringe";

import { appConfig } from "@src/billing/config";
import { envSchema } from "@src/billing/config/env.config";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class BillingConfigService extends ConfigService<typeof envSchema, typeof appConfig> {
  constructor() {
    super({ envSchema, config: appConfig });
  }
}

import { singleton } from "tsyringe";

import { envSchema } from "@src/billing/config/env.config";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class BillingConfigService extends ConfigService<typeof envSchema, unknown> {
  constructor() {
    super({ envSchema });
  }
}

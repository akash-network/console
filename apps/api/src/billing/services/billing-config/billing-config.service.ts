import { inject, singleton } from "tsyringe";

import { appConfig } from "@src/billing/config";
import type { BillingConfig } from "@src/billing/config/env.config";
import { envSchema } from "@src/billing/config/env.config";
import { BILLING_CONFIG } from "@src/billing/providers/config.provider";
import { ConfigService } from "@src/core/services/config/config.service";

@singleton()
export class BillingConfigService extends ConfigService<typeof envSchema, typeof appConfig> {
  constructor(@inject(BILLING_CONFIG) config: BillingConfig) {
    super({
      config: { ...appConfig, ...config }
    });
  }
}

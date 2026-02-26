import { inject, singleton } from "tsyringe";

import { ConfigService } from "@src/core/services/config/config.service";
import type { HealthzConfig } from "../../config/env.config";
import { envSchema } from "../../config/env.config";
import { HEALTHZ_CONFIG } from "../../providers/config.provider";

@singleton()
export class HealthzConfigService extends ConfigService<typeof envSchema> {
  constructor(@inject(HEALTHZ_CONFIG) config: HealthzConfig) {
    super({ config });
  }
}

import { inject, singleton } from "tsyringe";

import { ConfigService } from "@src/core/services/config/config.service";
import { WORKLOAD_ABUSE_CONFIG } from "@src/workload-abuse/config/config.provider";
import type { WorkloadAbuseConfig } from "@src/workload-abuse/config/env.config";
import { envSchema } from "@src/workload-abuse/config/env.config";

@singleton()
export class WorkloadAbuseConfigService extends ConfigService<typeof envSchema> {
  constructor(@inject(WORKLOAD_ABUSE_CONFIG) config: WorkloadAbuseConfig) {
    super({ config });
  }
}

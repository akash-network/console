import { singleton } from "tsyringe";

import type { DeploymentFundingConfigResponse } from "@src/deployment/http-schemas/deployment-funding-config.schema";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

@singleton()
export class DeploymentFundingConfigController {
  readonly #config: DeploymentConfigService;

  constructor(config: DeploymentConfigService) {
    this.#config = config;
  }

  getConfig(): DeploymentFundingConfigResponse {
    return {
      data: {
        targetRunwayHours: this.#config.get("AUTO_TOP_UP_TARGET_RUNWAY_IN_H"),
        balanceHeadroomUsd: this.#config.get("AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD"),
        defaultDepositUsd: this.#config.get("DEPLOYMENT_DEFAULT_DEPOSIT")
      }
    };
  }
}

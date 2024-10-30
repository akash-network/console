import { singleton } from "tsyringe";

import { LoggerService } from "@src/core";

@singleton()
export class TopUpDeploymentsService {
  private readonly logger = new LoggerService({ context: TopUpDeploymentsService.name });

  async topUpDeployments() {
    this.logger.warn("Top up deployments not implemented");
  }
}

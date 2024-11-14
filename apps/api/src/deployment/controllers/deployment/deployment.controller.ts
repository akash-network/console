import { singleton } from "tsyringe";

import { TopUpDeploymentsService } from "@src/deployment/services/top-up-deployments/top-up-deployments.service";

@singleton()
export class TopUpDeploymentsController {
  constructor(private readonly topUpDeploymentsService: TopUpDeploymentsService) {}

  async topUpDeployments() {
    await this.topUpDeploymentsService.topUpDeployments();
  }
}

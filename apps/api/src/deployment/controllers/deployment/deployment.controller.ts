import { singleton } from "tsyringe";

import { TopUpCustodialDeploymentsService } from "@src/deployment/services/top-up-custodial-deployments/top-up-custodial-deployments.service";

@singleton()
export class TopUpDeploymentsController {
  constructor(private readonly topUpDeploymentsService: TopUpCustodialDeploymentsService) {}

  async topUpDeployments() {
    await this.topUpDeploymentsService.topUpDeployments();
  }
}

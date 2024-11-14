import { singleton } from "tsyringe";

import { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { TopUpCustodialDeploymentsService } from "@src/deployment/services/top-up-custodial-deployments/top-up-custodial-deployments.service";

@singleton()
export class TopUpDeploymentsController {
  constructor(
    private readonly topUpDeploymentsService: TopUpCustodialDeploymentsService,
    private readonly staleDeploymentsCleanerService: StaleManagedDeploymentsCleanerService
  ) {}

  async topUpDeployments() {
    await this.topUpDeploymentsService.topUpDeployments();
  }

  async cleanUpStaleDeployment() {
    await this.staleDeploymentsCleanerService.cleanup();
  }
}

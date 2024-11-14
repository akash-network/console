import { singleton } from "tsyringe";

import { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { TopUpCustodialDeploymentsService } from "@src/deployment/services/top-up-custodial-deployments/top-up-custodial-deployments.service";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { TopUpDeploymentsOptions } from "@src/deployment/types/deployments-refiller";

@singleton()
export class TopUpDeploymentsController {
  constructor(
    private readonly topUpDeploymentsService: TopUpCustodialDeploymentsService,
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    private readonly staleDeploymentsCleanerService: StaleManagedDeploymentsCleanerService
  ) {}

  async topUpDeployments(options: TopUpDeploymentsOptions) {
    await this.topUpDeploymentsService.topUpDeployments(options);
    await this.topUpManagedDeploymentsService.topUpDeployments(options);
  }

  async cleanUpStaleDeployment() {
    await this.staleDeploymentsCleanerService.cleanup();
  }
}

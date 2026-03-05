import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";

@singleton()
export class TopUpDeploymentsController {
  constructor(
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    private readonly staleDeploymentsCleanerService: StaleManagedDeploymentsCleanerService
  ) {}

  async topUpDeployments(options: DryRunOptions) {
    await this.topUpManagedDeploymentsService.topUpDeployments(options);
  }

  async cleanUpStaleDeployment(options: CleanUpStaleDeploymentsParams) {
    await this.staleDeploymentsCleanerService.cleanup(options);
  }
}

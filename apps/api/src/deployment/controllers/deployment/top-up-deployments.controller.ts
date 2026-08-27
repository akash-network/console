import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import { ExpiringDeploymentsNotifierService } from "@src/deployment/services/expiring-deployments-notifier/expiring-deployments-notifier.service";
import { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";

@singleton()
export class TopUpDeploymentsController {
  constructor(
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    private readonly staleDeploymentsCleanerService: StaleManagedDeploymentsCleanerService,
    private readonly deploymentCloseJobService: DeploymentCloseJobService,
    private readonly expiringDeploymentsNotifierService: ExpiringDeploymentsNotifierService
  ) {}

  /** The reconcile runs whatever the funding sweep did, since an RPC blip there would strand a missing close job for another hour. */
  async topUpDeployments(options: DryRunOptions) {
    try {
      await this.topUpManagedDeploymentsService.topUpDeployments(options);
    } finally {
      await this.deploymentCloseJobService.reconcileExpired(options);
    }
  }

  async cleanUpStaleDeployment(options: CleanUpStaleDeploymentsParams) {
    await this.staleDeploymentsCleanerService.cleanup(options);
  }

  async notifyExpiringDeployments(options: DryRunOptions) {
    return await this.expiringDeploymentsNotifierService.notifyExpiringDeployments(options);
  }
}

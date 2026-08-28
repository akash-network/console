import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import { ExpiringDeploymentsNotifierService } from "@src/deployment/services/expiring-deployments-notifier/expiring-deployments-notifier.service";
import { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { UnreachableProviderDeploymentsCloserService } from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import { UnreachableProviderDeploymentsNotifierService } from "@src/deployment/services/unreachable-provider-deployments-notifier/unreachable-provider-deployments-notifier.service";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";

@singleton()
export class TopUpDeploymentsController {
  constructor(
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    private readonly staleDeploymentsCleanerService: StaleManagedDeploymentsCleanerService,
    private readonly deploymentCloseJobService: DeploymentCloseJobService,
    private readonly expiringDeploymentsNotifierService: ExpiringDeploymentsNotifierService,
    private readonly unreachableProviderDeploymentsNotifierService: UnreachableProviderDeploymentsNotifierService,
    private readonly unreachableProviderDeploymentsCloserService: UnreachableProviderDeploymentsCloserService
  ) {}

  /** The reconcile goes first because it only needs the database, so a chain-RPC failure in the sweep cannot skip it for the hour. */
  async topUpDeployments(options: DryRunOptions) {
    await this.deploymentCloseJobService.reconcileExpired(options);
    await this.topUpManagedDeploymentsService.topUpDeployments(options);
  }

  async cleanUpStaleDeployment(options: CleanUpStaleDeploymentsParams) {
    await this.staleDeploymentsCleanerService.cleanup(options);
  }

  async notifyExpiringDeployments(options: DryRunOptions) {
    return await this.expiringDeploymentsNotifierService.notifyExpiringDeployments(options);
  }

  async notifyUnreachableProviderDeployments(options: DryRunOptions) {
    return await this.unreachableProviderDeploymentsNotifierService.notifyUnreachableProviderDeployments(options);
  }

  async closeUnreachableProviderDeployments(options: DryRunOptions) {
    return await this.unreachableProviderDeploymentsCloserService.closeUnreachableProviderDeployments(options);
  }
}

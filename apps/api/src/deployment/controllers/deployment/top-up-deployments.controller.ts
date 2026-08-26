import { singleton } from "tsyringe";

import type { DryRunOptions } from "@src/core/types/console";
import { ExpiredDeploymentsCloserService } from "@src/deployment/services/expired-deployments-closer/expired-deployments-closer.service";
import { ExpiringDeploymentsNotifierService } from "@src/deployment/services/expiring-deployments-notifier/expiring-deployments-notifier.service";
import { OrphanedDefinitionsSweeperService } from "@src/deployment/services/orphaned-definitions-sweeper/orphaned-definitions-sweeper.service";
import { StaleManagedDeploymentsCleanerService } from "@src/deployment/services/stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";

@singleton()
export class TopUpDeploymentsController {
  constructor(
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    private readonly staleDeploymentsCleanerService: StaleManagedDeploymentsCleanerService,
    private readonly expiredDeploymentsCloserService: ExpiredDeploymentsCloserService,
    private readonly expiringDeploymentsNotifierService: ExpiringDeploymentsNotifierService,
    private readonly orphanedDefinitionsSweeperService: OrphanedDefinitionsSweeperService
  ) {}

  async topUpDeployments(options: DryRunOptions) {
    await this.topUpManagedDeploymentsService.topUpDeployments(options);
  }

  async cleanUpStaleDeployment(options: CleanUpStaleDeploymentsParams) {
    await this.staleDeploymentsCleanerService.cleanup(options);
  }

  async closeExpiredDeployments(options: DryRunOptions) {
    return await this.expiredDeploymentsCloserService.closeExpiredDeployments(options);
  }

  async notifyExpiringDeployments(options: DryRunOptions) {
    return await this.expiringDeploymentsNotifierService.notifyExpiringDeployments(options);
  }

  async sweepOrphanedDefinitions(options: DryRunOptions) {
    return await this.orphanedDefinitionsSweeperService.sweep(options);
  }
}

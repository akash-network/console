import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import type { JobHandler, JobPayload, JobPermissions } from "@src/core";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { TemplateUsageService } from "@src/template-marketplace/services/template-usage/template-usage.service";
import { CheckTemplateDeploymentStillRunning } from "./check-template-deployment-still-running.job";

@singleton()
export class CheckTemplateDeploymentStillRunningHandler implements JobHandler<CheckTemplateDeploymentStillRunning> {
  public readonly accepts = CheckTemplateDeploymentStillRunning;

  /** Gives the per-deployment key its meaning, so a lease followed up twice schedules one check; a `standard` queue ignores the key. */
  public readonly policy = "exclusive";

  public readonly concurrency = 2;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly leaseRepository: LeaseRepository,
    private readonly templateUsageService: TemplateUsageService
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A failed chain read throws so pg-boss retries it, because reading it as no lease would undercount a deployment that is still up. */
  async handle({ deploymentSettingId, walletId, dseq, isTrial }: JobPayload<CheckTemplateDeploymentStillRunning>): Promise<void> {
    const wallet = await this.userWalletRepository.findOneBy({ id: walletId });
    if (!wallet?.address) return;

    const activeLeases = await this.leaseRepository.findActiveLeasesOfDeployment(wallet.address, dseq);
    if (activeLeases.length === 0) return;

    await this.templateUsageService.recordStillRunning({ deploymentSettingId, dseq, isTrial });
  }
}

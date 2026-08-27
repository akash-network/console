import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { CloseUnreachableProviderDeploymentCommand } from "@src/deployment/commands/close-unreachable-provider-deployment.command";
import { type DarkDeployment, resolveFullyDarkDeployment } from "@src/deployment/lib/dark-deployment/dark-deployment";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { type ActiveLeaseOnProvider, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { type ProviderOutage, ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";

export type CloseUnreachableProviderDeploymentTarget = {
  owner: string;
  dseq: string;
};

/** Only fully dark deployments qualify, because one lease still answering may well be doing useful work the owner can see. */
@singleton()
export class UnreachableProviderDeploymentsCloserService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly providerOutagesHttpService: ProviderOutagesHttpService,
    private readonly leaseRepository: LeaseRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: UnreachableProviderDeploymentsCloserService.name });
  }

  static singletonKey(target: CloseUnreachableProviderDeploymentTarget): string {
    return `${CloseUnreachableProviderDeploymentCommand[JOB_NAME]}.${target.owner}.${target.dseq}`;
  }

  /** A dry run enqueues nothing, which gates the whole pipeline because this sweep is the only thing that creates these jobs. */
  async closeUnreachableProviderDeployments({ dryRun }: DryRunOptions): Promise<Result<void, unknown[]>> {
    const outages = await this.providerOutagesHttpService.findOutagesOlderThanDays(this.config.get("PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS"));
    const deployments = await this.#findFullyDarkDeployments(outages);

    this.logger.info({ event: "UNREACHABLE_PROVIDER_DEPLOYMENTS_CLOSE_SWEEP_START", outages: outages.length, count: deployments.length, dryRun });

    const errors: unknown[] = [];
    let scheduledCount = 0;
    let alreadyScheduledCount = 0;
    const pendingKeys = dryRun ? new Set<string>() : await this.jobQueueService.findPendingSingletonKeys(CloseUnreachableProviderDeploymentCommand[JOB_NAME]);

    for (const deployment of deployments) {
      try {
        if (!(await this.#isCloseable(deployment))) continue;

        if (dryRun) {
          this.logger.info({
            event: "UNREACHABLE_PROVIDER_DEPLOYMENT_WOULD_CLOSE",
            dseq: deployment.dseq,
            owner: deployment.owner,
            hostUri: deployment.hostUri,
            downSince: deployment.downSince
          });
          continue;
        }

        if (pendingKeys.has(UnreachableProviderDeploymentsCloserService.singletonKey(deployment))) {
          alreadyScheduledCount++;
          continue;
        }

        await this.schedule(deployment);
        scheduledCount++;
      } catch (error) {
        this.logger.error({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_SCHEDULE_FAILED", dseq: deployment.dseq, owner: deployment.owner, error });
        errors.push(error);
      }
    }

    this.logger.info({
      event: "UNREACHABLE_PROVIDER_DEPLOYMENTS_CLOSE_SWEEP_END",
      found: deployments.length,
      scheduled: scheduledCount,
      alreadyScheduled: alreadyScheduledCount,
      failed: errors.length,
      dryRun
    });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  /** A duplicate that slips past the pending-key check is harmless: the handler re-reads the outage and the row, so it closes nothing twice. */
  async schedule(target: CloseUnreachableProviderDeploymentTarget, options: { startAfter?: Date } = {}): Promise<string> {
    const startAfter = options.startAfter && new Date(Math.max(options.startAfter.getTime(), Date.now()));

    const createdJobId = await this.jobQueueService.enqueue(new CloseUnreachableProviderDeploymentCommand({ owner: target.owner, dseq: target.dseq }), {
      singletonKey: UnreachableProviderDeploymentsCloserService.singletonKey(target),
      ...(startAfter && { startAfter: startAfter.toISOString() })
    });

    if (!createdJobId) {
      throw new Error(`Failed to schedule unreachable-provider close for deployment ${target.dseq} of ${target.owner}`);
    }

    return createdJobId;
  }

  /** Re-checked per job because the unsettleable-escrow path can retry for hours, and closing a deployment whose provider came back cannot be undone. */
  async findStillDarkDeployment(target: CloseUnreachableProviderDeploymentTarget): Promise<DarkDeployment | null> {
    const leases = await this.leaseRepository.findActiveLeasesOfDeployment(target.owner, target.dseq);

    if (leases.length === 0) return null;

    const outages = await this.providerOutagesHttpService.findOutagesOlderThanDays(this.config.get("PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS"));

    return resolveFullyDarkDeployment(leases, new Map(outages.map(outage => [outage.provider, outage])));
  }

  /** Screens out what the handler would skip anyway, so a dry run's count is the count that would really be closed. */
  async #isCloseable(deployment: DarkDeployment): Promise<boolean> {
    const wallet = await this.userWalletRepository.findOneByAddress(deployment.owner);

    if (!wallet?.address) {
      this.logger.debug({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_SKIPPED",
        reason: "NOT_A_MANAGED_WALLET",
        dseq: deployment.dseq,
        owner: deployment.owner
      });
      return false;
    }

    const setting = await this.deploymentSettingRepository.findOneBy({ userId: wallet.userId, dseq: deployment.dseq });

    if (setting?.closed) {
      this.logger.debug({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_SKIPPED",
        reason: "ALREADY_CLOSED",
        dseq: deployment.dseq,
        owner: deployment.owner
      });
      return false;
    }

    return true;
  }

  async #findFullyDarkDeployments(outages: ProviderOutage[]): Promise<DarkDeployment[]> {
    if (outages.length === 0) return [];

    const outageByProvider = new Map(outages.map(outage => [outage.provider, outage]));
    const leases = await this.leaseRepository.findActiveLeasesOfDeploymentsOnProviders([...outageByProvider.keys()]);
    const leasesByDeployment = new Map<string, ActiveLeaseOnProvider[]>();

    for (const lease of leases) {
      const key = `${lease.owner}/${lease.dseq}`;
      leasesByDeployment.set(key, [...(leasesByDeployment.get(key) ?? []), lease]);
    }

    return [...leasesByDeployment.values()]
      .map(deploymentLeases => resolveFullyDarkDeployment(deploymentLeases, outageByProvider))
      .filter(deployment => !!deployment);
  }
}

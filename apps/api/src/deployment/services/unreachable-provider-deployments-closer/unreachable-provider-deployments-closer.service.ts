import { differenceInDays } from "date-fns";
import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { type ActiveLeaseOnProvider, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { type ProviderOutage, ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";

/** A deployment whose every active lease sits on a provider that stopped answering. */
interface DarkDeployment {
  owner: string;
  dseq: string;
  hostUri: string;
  downSince: string;
}

/** Only fully dark deployments are closed, because one lease still answering may well be doing useful work the owner can see. */
@singleton()
export class UnreachableProviderDeploymentsCloserService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly providerOutagesHttpService: ProviderOutagesHttpService,
    private readonly leaseRepository: LeaseRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly chainErrorService: ChainErrorService,
    private readonly jobQueueService: JobQueueService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: UnreachableProviderDeploymentsCloserService.name });
  }

  async closeUnreachableProviderDeployments({ dryRun }: DryRunOptions): Promise<Result<void, unknown[]>> {
    const outages = await this.providerOutagesHttpService.findOutagesOlderThanDays(this.config.get("PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS"));
    const deployments = await this.#findFullyDarkDeployments(outages);

    this.logger.info({ event: "UNREACHABLE_PROVIDER_DEPLOYMENTS_CLOSE_SWEEP_START", outages: outages.length, count: deployments.length, dryRun });

    const errors: unknown[] = [];
    let closedCount = 0;

    for (const deployment of deployments) {
      try {
        if (await this.#closeDeployment(deployment, dryRun, errors)) {
          closedCount++;
        }
      } catch (error) {
        this.logger.error({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_FAILED", dseq: deployment.dseq, owner: deployment.owner, error });
        errors.push(error);
      }
    }

    this.logger.info({
      event: "UNREACHABLE_PROVIDER_DEPLOYMENTS_CLOSE_SWEEP_END",
      found: deployments.length,
      closed: closedCount,
      failed: errors.length,
      dryRun
    });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  /** Where several leases are dark, the longest outage is the one reported, so the host named and the age beside it come from the same outage. */
  async #findFullyDarkDeployments(outages: ProviderOutage[]): Promise<DarkDeployment[]> {
    if (outages.length === 0) return [];

    const outageByProvider = new Map(outages.map(outage => [outage.provider, outage]));
    const leases = await this.leaseRepository.findActiveLeasesOfDeploymentsOnProviders([...outageByProvider.keys()]);
    const leasesByDeployment = new Map<string, ActiveLeaseOnProvider[]>();

    for (const lease of leases) {
      const key = `${lease.owner}/${lease.dseq}`;
      leasesByDeployment.set(key, [...(leasesByDeployment.get(key) ?? []), lease]);
    }

    const dark: DarkDeployment[] = [];

    for (const deploymentLeases of leasesByDeployment.values()) {
      const deploymentOutages = deploymentLeases.map(lease => outageByProvider.get(lease.providerAddress));
      if (deploymentOutages.some(outage => !outage)) continue;

      const [{ owner, dseq }] = deploymentLeases;
      const longestOutage = (deploymentOutages as ProviderOutage[]).reduce((longest, outage) => (outage.startedAt < longest.startedAt ? outage : longest));

      dark.push({
        owner,
        dseq,
        hostUri: longestOutage.hostUri,
        downSince: longestOutage.startedAt
      });
    }

    return dark;
  }

  async #closeDeployment(deployment: DarkDeployment, dryRun: boolean, errors: unknown[]): Promise<boolean> {
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

    if (dryRun) {
      this.logger.info({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_WOULD_CLOSE",
        dseq: deployment.dseq,
        owner: deployment.owner,
        hostUri: deployment.hostUri,
        downSince: deployment.downSince
      });
      return false;
    }

    try {
      await this.deploymentWriterService.close({ ...wallet, address: wallet.address }, deployment.dseq);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
        this.logger.warn({
          event: "UNREACHABLE_PROVIDER_DEPLOYMENT_UNSETTLEABLE",
          reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
          dseq: deployment.dseq,
          owner: deployment.owner
        });
        return false;
      }
      throw error;
    }

    await this.#recordClosed(deployment, wallet, errors);

    this.logger.info({
      event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSED",
      dseq: deployment.dseq,
      owner: deployment.owner,
      hostUri: deployment.hostUri,
      downSince: deployment.downSince
    });

    await this.#notifyOwner(deployment, wallet, errors);

    return true;
  }

  /** A database that refuses the marking is collected rather than thrown, or the owner loses the email explaining a close that already happened. */
  async #recordClosed(deployment: DarkDeployment, wallet: { userId: string }, errors: unknown[]): Promise<void> {
    try {
      await this.deploymentSettingRepository.markClosed({ userId: wallet.userId, dseq: deployment.dseq });
    } catch (error) {
      this.logger.error({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_RECORD_FAILED",
        dseq: deployment.dseq,
        owner: deployment.owner,
        error
      });
      errors.push(error);
    }
  }

  /** The close is already on chain by the time this runs, so a queue that refuses the job is collected rather than thrown. */
  async #notifyOwner(deployment: DarkDeployment, wallet: { id: number; userId: string }, errors: unknown[]): Promise<void> {
    try {
      await this.jobQueueService.enqueue(
        new NotificationJob({
          template: "providerUnreachableClosed",
          userId: wallet.userId,
          vars: {
            dseq: deployment.dseq,
            owner: deployment.owner,
            hostUri: deployment.hostUri,
            downForDays: differenceInDays(new Date(), new Date(deployment.downSince)),
            redeployUrl: `${this.config.get("DEPLOY_WEB_BASE_URL")}/new-deployment`
          }
        }),
        { singletonKey: `notification.providerUnreachableClosed.${deployment.dseq}.${wallet.id}` }
      );
    } catch (error) {
      this.logger.error({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_NOTIFICATION_FAILED",
        dseq: deployment.dseq,
        owner: deployment.owner,
        error
      });
      errors.push(error);
    }
  }
}

import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { type ActiveLeaseOnProvider, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { type ProviderOutage, ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { providerUnreachableNotification } from "@src/notifications/services/notification-templates/provider-unreachable-notification";
import { UserRepository } from "@src/user/repositories";

/** A deployment with at least one lease on a provider that has gone dark, and the outage to tell its owner about. */
interface DarkDeployment {
  owner: string;
  dseq: string;
  hostUri: string;
  downSince: string;
  isFullyDark: boolean;
}

/** Managed wallets only, since a self-custody deployment has no account behind its address and so nobody to email. */
@singleton()
export class UnreachableProviderDeploymentsNotifierService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly providerOutagesHttpService: ProviderOutagesHttpService,
    private readonly leaseRepository: LeaseRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: UnreachableProviderDeploymentsNotifierService.name });
  }

  async notifyUnreachableProviderDeployments({ dryRun }: DryRunOptions): Promise<Result<void, unknown[]>> {
    const outages = await this.providerOutagesHttpService.findOutagesOlderThanDays(this.config.get("PROVIDER_UNREACHABLE_NOTIFY_AFTER_DAYS"));
    const deployments = await this.#findDarkDeployments(outages);

    this.logger.info({ event: "UNREACHABLE_PROVIDER_DEPLOYMENTS_SWEEP_START", outages: outages.length, count: deployments.length, dryRun });

    const errors: unknown[] = [];
    let notifiedCount = 0;

    for (const deployment of deployments) {
      try {
        if (await this.#notifyOwner(deployment, dryRun)) {
          notifiedCount++;
        }
      } catch (error) {
        this.logger.error({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_NOTIFY_FAILED", dseq: deployment.dseq, owner: deployment.owner, error });
        errors.push(error);
      }
    }

    this.logger.info({
      event: "UNREACHABLE_PROVIDER_DEPLOYMENTS_SWEEP_END",
      found: deployments.length,
      notified: notifiedCount,
      failed: errors.length,
      dryRun
    });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  /** One dark lease is enough, and where several are dark the longest outage is reported so the age the owner reads is the age of the problem. */
  async #findDarkDeployments(outages: ProviderOutage[]): Promise<DarkDeployment[]> {
    if (outages.length === 0) return [];

    const outageByProvider = new Map(outages.map(outage => [outage.provider, outage]));
    const leases = await this.leaseRepository.findActiveLeasesOfDeploymentsOnProviders([...outageByProvider.keys()]);
    const leasesByDeployment = new Map<string, ActiveLeaseOnProvider[]>();

    for (const lease of leases) {
      const key = this.#deploymentKey(lease);
      leasesByDeployment.set(key, [...(leasesByDeployment.get(key) ?? []), lease]);
    }

    const dark: DarkDeployment[] = [];

    for (const deploymentLeases of leasesByDeployment.values()) {
      const deploymentOutages = deploymentLeases.map(lease => outageByProvider.get(lease.providerAddress)).filter(outage => !!outage);
      if (deploymentOutages.length === 0) continue;

      const [{ owner, dseq }] = deploymentLeases;
      const longestOutage = deploymentOutages.reduce((longest, outage) => (outage.startedAt < longest.startedAt ? outage : longest));

      dark.push({
        owner,
        dseq,
        hostUri: longestOutage.hostUri,
        downSince: longestOutage.startedAt,
        isFullyDark: deploymentOutages.length === deploymentLeases.length
      });
    }

    return dark;
  }

  #deploymentKey(lease: ActiveLeaseOnProvider): string {
    return `${lease.owner}/${lease.dseq}`;
  }

  async #notifyOwner(deployment: DarkDeployment, dryRun: boolean): Promise<boolean> {
    const wallet = await this.userWalletRepository.findOneByAddress(deployment.owner);

    if (!wallet) {
      this.logger.debug({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_SKIPPED",
        reason: "NOT_A_MANAGED_WALLET",
        dseq: deployment.dseq,
        owner: deployment.owner
      });
      return false;
    }

    const setting = await this.deploymentSettingRepository.findOneBy({ userId: wallet.userId, dseq: deployment.dseq });

    if (setting?.providerUnreachableNotifiedFor?.toISOString() === deployment.downSince) {
      this.logger.debug({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_SKIPPED",
        reason: "ALREADY_NOTIFIED",
        dseq: deployment.dseq,
        owner: deployment.owner
      });
      return false;
    }

    const user = await this.userRepository.findById(wallet.userId);

    if (!user?.email) {
      this.logger.warn({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_SKIPPED",
        reason: "USER_HAS_NO_EMAIL",
        dseq: deployment.dseq,
        userId: wallet.userId
      });
      return false;
    }

    if (dryRun) {
      this.logger.info({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_WOULD_NOTIFY",
        dseq: deployment.dseq,
        owner: deployment.owner,
        hostUri: deployment.hostUri,
        downSince: deployment.downSince
      });
      return false;
    }

    const claim = { userId: wallet.userId, dseq: deployment.dseq, downSinceMarker: deployment.downSince };
    const claimed = await this.deploymentSettingRepository.claimProviderUnreachableNotification(claim);

    if (!claimed) {
      this.logger.info({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_SKIPPED",
        reason: "ALREADY_NOTIFIED",
        dseq: deployment.dseq,
        owner: deployment.owner
      });
      return false;
    }

    try {
      await this.notificationService.createNotification(
        providerUnreachableNotification(user, {
          dseq: deployment.dseq,
          owner: deployment.owner,
          hostUri: deployment.hostUri,
          downSince: deployment.downSince,
          closeAfterDays: deployment.isFullyDark ? this.config.get("PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS") : undefined,
          deploymentUrl: this.#deploymentUrl(deployment.dseq)
        })
      );
    } catch (error) {
      await this.#releaseClaim(deployment, claim);
      throw error;
    }

    this.logger.info({
      event: "UNREACHABLE_PROVIDER_DEPLOYMENT_NOTIFIED",
      dseq: deployment.dseq,
      owner: deployment.owner,
      hostUri: deployment.hostUri,
      downSince: deployment.downSince
    });

    return true;
  }

  /** A failed release is logged rather than thrown, because it would replace the send error the caller reports. */
  async #releaseClaim(deployment: DarkDeployment, claim: { userId: string; dseq: string; downSinceMarker: string }): Promise<void> {
    try {
      await this.deploymentSettingRepository.releaseProviderUnreachableClaim(claim);
    } catch (error) {
      this.logger.error({
        event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLAIM_RELEASE_FAILED",
        dseq: deployment.dseq,
        owner: deployment.owner,
        error
      });
    }
  }

  #deploymentUrl(dseq: string): string {
    return `${this.config.get("DEPLOY_WEB_BASE_URL")}/deployments/${dseq}`;
  }
}

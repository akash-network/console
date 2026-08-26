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
}

/**
 * Tells owners that the provider hosting their deployment has stopped answering, which today nothing
 * does: escrow keeps draining toward a provider that is no longer serving the workload, and the owner
 * finds out only when they happen to open the deployment.
 *
 * One email per outage. A provider that recovers and goes dark again is worth telling the owner about
 * a second time; a single outage dragging on for weeks is not.
 *
 * Managed wallets only. A self-custody deployment has no account behind its address, so there is no
 * one to email.
 */
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

  /**
   * A deployment counts as dark as soon as one of its leases sits on an unreachable provider — a
   * workload split across providers is already broken when one of them disappears. Where several are
   * dark, the longest outage is the one reported, so the age the owner reads is the age of the problem.
   */
  async #findDarkDeployments(outages: ProviderOutage[]): Promise<DarkDeployment[]> {
    if (outages.length === 0) return [];

    const outageByProvider = new Map(outages.map(outage => [outage.provider, outage]));
    const leases = await this.leaseRepository.findActiveLeasesOfDeploymentsOnProviders([...outageByProvider.keys()]);
    const darkByDeployment = new Map<string, DarkDeployment>();

    for (const lease of leases) {
      const outage = outageByProvider.get(lease.providerAddress);
      if (!outage) continue;

      const key = this.#deploymentKey(lease);
      const known = darkByDeployment.get(key);
      if (known && known.downSince <= outage.startedAt) continue;

      darkByDeployment.set(key, {
        owner: lease.owner,
        dseq: lease.dseq,
        hostUri: outage.hostUri,
        downSince: outage.startedAt
      });
    }

    return [...darkByDeployment.values()];
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

  /**
   * A claim whose email never went out is given back so the next sweep retries it. A failed release is
   * logged rather than thrown: it would replace the send error the caller reports, and the cost is one
   * owner warned late or not at all, which is what the claim was already risking.
   */
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

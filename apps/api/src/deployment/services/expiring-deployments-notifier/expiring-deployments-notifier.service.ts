import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { runtimeLimitEndingNotification } from "@src/notifications/services/notification-templates/runtime-limit-ending-notification";
import { UserRepository } from "@src/user/repositories";
import { DeploymentSettingRepository, type ExpiringRuntimeDeployment } from "../../repositories/deployment-setting/deployment-setting.repository";

/**
 * Warns users that a runtime-limited deployment is about to reach its limit and be closed, while they can
 * still keep it running. Without this the deployment simply stops: the deployment's close job runs the
 * moment the deadline passes, and a user who forgot about the limit or changed their mind finds out only
 * afterwards.
 *
 * One email per deadline. Extending the limit moves the deadline, which re-arms the warning for the new one;
 * lifting the limit clears the deadline and takes the deployment out of the sweep for good.
 */
@singleton()
export class ExpiringDeploymentsNotifierService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ExpiringDeploymentsNotifierService.name });
  }

  async notifyExpiringDeployments({ dryRun }: DryRunOptions): Promise<Result<void, unknown[]>> {
    const expiring = await this.deploymentSettingRepository.findExpiringRuntimeDeployments({
      leadHours: this.config.get("RUNTIME_LIMIT_WARNING_LEAD_IN_H"),
      minLimitHours: this.config.get("RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H")
    });

    this.logger.info({ event: "EXPIRING_DEPLOYMENTS_SWEEP_START", count: expiring.length, dryRun });

    const errors: unknown[] = [];
    let notifiedCount = 0;

    for (const deployment of expiring) {
      try {
        if (await this.#notifyExpiringDeployment(deployment, dryRun)) {
          notifiedCount++;
        }
      } catch (error) {
        this.logger.error({ event: "EXPIRING_DEPLOYMENT_NOTIFY_FAILED", dseq: deployment.dseq, owner: deployment.address, error });
        errors.push(error);
      }
    }

    this.logger.info({
      event: "EXPIRING_DEPLOYMENTS_SWEEP_END",
      found: expiring.length,
      notified: notifiedCount,
      failed: errors.length,
      dryRun
    });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  async #notifyExpiringDeployment(deployment: ExpiringRuntimeDeployment, dryRun: boolean): Promise<boolean> {
    const user = await this.userRepository.findById(deployment.userId);

    if (!user?.email) {
      this.logger.warn({
        event: "EXPIRING_DEPLOYMENT_SKIPPED",
        reason: "USER_HAS_NO_EMAIL",
        dseq: deployment.dseq,
        userId: deployment.userId
      });
      return false;
    }

    if (dryRun) {
      this.logger.info({
        event: "EXPIRING_DEPLOYMENT_WOULD_NOTIFY",
        dseq: deployment.dseq,
        owner: deployment.address,
        runtimeEndsAt: deployment.runtimeEndsAt
      });
      return false;
    }

    const claimed = await this.deploymentSettingRepository.claimRuntimeEndingNotification(deployment.id, deployment.runtimeEndsAtMarker);

    if (!claimed) {
      this.logger.info({
        event: "EXPIRING_DEPLOYMENT_SKIPPED",
        reason: "ALREADY_NOTIFIED",
        dseq: deployment.dseq,
        owner: deployment.address
      });
      return false;
    }

    try {
      await this.notificationService.createNotification(
        runtimeLimitEndingNotification(user, {
          dseq: deployment.dseq,
          owner: deployment.address,
          runtimeEndsAt: deployment.runtimeEndsAt.toISOString(),
          deploymentSettingsUrl: this.#deploymentSettingsUrl(deployment.dseq)
        })
      );
    } catch (error) {
      await this.#releaseClaim(deployment);
      throw error;
    }

    this.logger.info({
      event: "EXPIRING_DEPLOYMENT_NOTIFIED",
      dseq: deployment.dseq,
      owner: deployment.address,
      runtimeEndsAt: deployment.runtimeEndsAt
    });

    return true;
  }

  /**
   * A claim whose email never went out is given back so the next sweep retries it. A failed release is
   * logged rather than thrown: it would replace the send error the caller reports, and the cost is one
   * deployment warned late or not at all, which is what the claim was already risking.
   */
  async #releaseClaim(deployment: ExpiringRuntimeDeployment): Promise<void> {
    try {
      await this.deploymentSettingRepository.releaseRuntimeEndingClaim(deployment.id, deployment.runtimeEndsAtMarker);
    } catch (error) {
      this.logger.error({ event: "EXPIRING_DEPLOYMENT_CLAIM_RELEASE_FAILED", dseq: deployment.dseq, owner: deployment.address, error });
    }
  }

  /** `tab=SETTINGS` is the query the deployment detail page reads to open the tab holding the extend and switch-to-always-on controls. */
  #deploymentSettingsUrl(dseq: ExpiringRuntimeDeployment["dseq"]): string {
    return `${this.config.get("DEPLOY_WEB_BASE_URL")}/deployments/${dseq}?tab=SETTINGS`;
  }
}

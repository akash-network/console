import { minutesToMilliseconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { type CreateLogger, type JobHandler, type JobPayload, LOGGER_FACTORY } from "@src/core";
import { CloseExpiredDeploymentCommand } from "@src/deployment/commands/close-expired-deployment.command";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { type CloseExpiredDeploymentTarget, DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

/** How long a close that could not go through yet waits before it is tried again. */
const RETRY_DELAY_MS = minutesToMilliseconds(15);

/**
 * Closes a deployment that has reached its runtime limit, which is what makes a limit mean anything:
 * without this the chain only closes a deployment once its escrow drains, so a cheap deployment holding
 * the default deposit outlives a short limit by weeks. Closing settles the escrow and returns the
 * remainder, so a limit reached early costs the user nothing extra.
 *
 * The job carries no deadline of its own and re-reads the row instead, which lets every site that
 * schedules one be approximate. A job that fires before a deadline that has since moved reschedules
 * itself, a job for a limit that was dropped does nothing, and a deployment whose job was lost is given
 * a new one by the hourly reconcile. An extension that lands while a close is in flight loses the race
 * by design: the deadline moved, but this job had already read it, which is the same outcome as
 * extending a second too late.
 */
@singleton()
export class CloseExpiredDeploymentHandler implements JobHandler<CloseExpiredDeploymentCommand> {
  public readonly accepts = CloseExpiredDeploymentCommand;

  public readonly concurrency = 2;

  /**
   * With the per-deployment singletonKey on the command, the `singleton` policy keeps a reconciled
   * duplicate from broadcasting a close for the same deployment concurrently with the job it duplicates
   * (a plain `standard` queue ignores singletonKey), while different deployments still close in
   * parallel up to `concurrency`.
   */
  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly deploymentCloseJobService: DeploymentCloseJobService,
    private readonly chainErrorService: ChainErrorService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CloseExpiredDeploymentHandler.name });
  }

  async handle(payload: JobPayload<CloseExpiredDeploymentCommand>): Promise<void> {
    const { deploymentSettingId, userId, dseq } = payload;
    const target = { deploymentSettingId, userId, dseq };
    const setting = await this.deploymentSettingRepository.findOneBy({ id: deploymentSettingId });

    if (!setting || setting.closed || !setting.runtimeEndsAt) {
      this.logger.info({
        event: "EXPIRED_DEPLOYMENT_SKIPPED",
        reason: !setting ? "SETTING_NOT_FOUND" : setting.closed ? "ALREADY_CLOSED" : "RUNTIME_LIMIT_REMOVED",
        deploymentSettingId,
        dseq
      });
      return;
    }

    if (setting.runtimeEndsAt.getTime() > Date.now()) {
      this.logger.info({ event: "EXPIRED_DEPLOYMENT_RESCHEDULED", deploymentSettingId, dseq, runtimeEndsAt: setting.runtimeEndsAt });
      await this.deploymentCloseJobService.schedule(target, { startAfter: setting.runtimeEndsAt, withCleanup: true });
      return;
    }

    const wallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!wallet?.address) {
      this.logger.warn({ event: "EXPIRED_DEPLOYMENT_WALLET_NOT_INITIALIZED", deploymentSettingId, dseq, userId });
      await this.#retryLater(target);
      return;
    }

    if (this.deploymentConfig.get("CLOSE_EXPIRED_DEPLOYMENTS_DRY_RUN") === "true") {
      this.logger.info({ event: "EXPIRED_DEPLOYMENT_WOULD_CLOSE", dseq, owner: wallet.address, walletId: wallet.id });
      await this.#retryLater(target);
      return;
    }

    try {
      await this.deploymentWriterService.close({ ...wallet, address: wallet.address }, dseq);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
        this.logger.warn({
          event: "EXPIRED_DEPLOYMENT_UNSETTLEABLE",
          reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
          dseq,
          owner: wallet.address
        });
        await this.#retryLater(target);
        return;
      }
      throw error;
    }

    await this.deploymentSettingRepository.updateById(deploymentSettingId, { closed: true });

    this.logger.info({ event: "EXPIRED_DEPLOYMENT_CLOSED", dseq, owner: wallet.address });
  }

  /**
   * A fresh job rather than a thrown error, so a close the chain is not ready for keeps being retried
   * past the queue's retry budget the way the every-15-minutes sweep this replaces did. Errors are left
   * to throw, where the retry budget and the dead-letter state are what should apply.
   */
  async #retryLater(target: CloseExpiredDeploymentTarget): Promise<void> {
    await this.deploymentCloseJobService.schedule(target, { startAfter: new Date(Date.now() + RETRY_DELAY_MS), withCleanup: true });
  }
}

import { differenceInDays, minutesToMilliseconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { type CreateLogger, type JobHandler, type JobPayload, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { CloseUnreachableProviderDeploymentCommand } from "@src/deployment/commands/close-unreachable-provider-deployment.command";
import type { DarkDeployment } from "@src/deployment/lib/dark-deployment/dark-deployment";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import {
  type CloseUnreachableProviderDeploymentTarget,
  UnreachableProviderDeploymentsCloserService
} from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";

/** How long a close the chain is not ready to settle waits before it is tried again. */
const RETRY_DELAY_MS = minutesToMilliseconds(15);

/** Whether the deployment is still ours to close is re-read here, so a job that waited out a long escrow retry decides on what is true when it runs. */
@singleton()
export class CloseUnreachableProviderDeploymentHandler implements JobHandler<CloseUnreachableProviderDeploymentCommand> {
  public readonly accepts = CloseUnreachableProviderDeploymentCommand;

  public readonly concurrency = 2;

  /** The per-deployment singletonKey plus this policy keeps a duplicate from broadcasting a close concurrently with the job it duplicates. */
  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly closeJobService: UnreachableProviderDeploymentsCloserService,
    private readonly chainErrorService: ChainErrorService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CloseUnreachableProviderDeploymentHandler.name });
  }

  async handle(payload: JobPayload<CloseUnreachableProviderDeploymentCommand>): Promise<void> {
    const { owner, dseq } = payload;

    const wallet = await this.userWalletRepository.findOneByAddress(owner);

    if (!wallet?.address) {
      this.logger.debug({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_SKIPPED", reason: "NOT_A_MANAGED_WALLET", dseq, owner });
      return;
    }

    const setting = await this.deploymentSettingRepository.findOneBy({ userId: wallet.userId, dseq });

    if (setting?.closed) {
      this.logger.debug({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_SKIPPED", reason: "ALREADY_CLOSED", dseq, owner });
      return;
    }

    const deployment = await this.closeJobService.findStillDarkDeployment({ owner, dseq });

    if (!deployment) {
      this.logger.info({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_SKIPPED", reason: "NO_LONGER_FULLY_DARK", dseq, owner });
      return;
    }

    let closedByUs: boolean;

    try {
      closedByUs = await this.deploymentWriterService.close({ ...wallet, address: wallet.address }, dseq);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
        this.logger.warn({
          event: "UNREACHABLE_PROVIDER_DEPLOYMENT_UNSETTLEABLE",
          reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
          dseq,
          owner
        });
        await this.#retryLater({ owner, dseq });
        return;
      }
      throw error;
    }

    await this.#recordAndNotify(deployment, wallet);

    if (!closedByUs) {
      this.logger.info({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSE_LANDED_ELSEWHERE", dseq, owner });
    }

    this.logger.info({
      event: "UNREACHABLE_PROVIDER_DEPLOYMENT_CLOSED",
      dseq,
      owner,
      hostUri: deployment.hostUri,
      downSince: deployment.downSince
    });
  }

  /** One transaction, so a deployment is never recorded as closed without the email explaining it queued alongside, and never told twice. */
  async #recordAndNotify(deployment: DarkDeployment, wallet: { id: number; userId: string }): Promise<void> {
    await this.txService.transaction(async () => {
      await this.deploymentSettingRepository.markClosed({ userId: wallet.userId, dseq: deployment.dseq });

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
    });
  }

  /** A fresh job rather than a throw, so an escrow the chain will not settle keeps retrying past the queue's retry budget. */
  async #retryLater(target: CloseUnreachableProviderDeploymentTarget): Promise<void> {
    await this.closeJobService.schedule(target, { startAfter: new Date(Date.now() + RETRY_DELAY_MS) });
  }
}

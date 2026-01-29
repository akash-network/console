import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { Job, JOB_NAME, JobHandler, JobPayload, LoggerService } from "@src/core";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

export class CloseBlockedUserDeployments implements Job {
  static readonly [JOB_NAME] = "CloseBlockedUserDeployments";
  readonly name = CloseBlockedUserDeployments[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
    }
  ) {}
}

@singleton()
export class CloseBlockedUserDeploymentsHandler implements JobHandler<CloseBlockedUserDeployments> {
  public readonly accepts = CloseBlockedUserDeployments;

  public readonly concurrency = 5;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly logger: LoggerService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentWriterService: DeploymentWriterService
  ) {}

  async handle(payload: JobPayload<CloseBlockedUserDeployments>): Promise<void> {
    const wallet = await this.userWalletRepository.findOneByUserId(payload.userId);

    if (!wallet) {
      this.logger.warn({
        event: "SKIP_CLOSE_BLOCKED_USER_DEPLOYMENTS",
        reason: "Wallet not found",
        job: CloseBlockedUserDeployments[JOB_NAME],
        userId: payload.userId
      });
      return;
    }

    const { address } = wallet;

    if (!address) {
      this.logger.debug({
        event: "SKIP_CLOSE_BLOCKED_USER_DEPLOYMENTS",
        reason: "Wallet is not initialized",
        job: CloseBlockedUserDeployments[JOB_NAME],
        userId: payload.userId
      });
      return;
    }

    const { deployments } = await this.deploymentReaderService.list({
      query: { userId: payload.userId }
    });

    for (const deployment of deployments) {
      const dseq = deployment.deployment.id.dseq;
      try {
        await this.deploymentWriterService.close({ ...wallet, address }, dseq);
        this.logger.info({
          event: "BLOCKED_USER_DEPLOYMENT_CLOSED",
          job: CloseBlockedUserDeployments[JOB_NAME],
          userId: payload.userId,
          dseq
        });
      } catch (error) {
        this.logger.error({
          event: "BLOCKED_USER_DEPLOYMENT_CLOSE_FAILED",
          job: CloseBlockedUserDeployments[JOB_NAME],
          userId: payload.userId,
          dseq,
          error
        });
      }
    }
  }
}

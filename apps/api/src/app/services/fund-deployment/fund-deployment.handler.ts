import { singleton } from "tsyringe";

import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import type { JobHandler, JobPayload } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";
import { InitialDeploymentFundingService } from "@src/deployment/services/initial-deployment-funding/initial-deployment-funding.service";

@singleton()
export class FundDeploymentHandler implements JobHandler<FundDeploymentCommand> {
  public readonly accepts = FundDeploymentCommand;

  public readonly concurrency = 2;

  constructor(
    private readonly initialDeploymentFundingService: InitialDeploymentFundingService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: JobPayload<FundDeploymentCommand>): Promise<void> {
    this.logger.debug({ event: "FUND_DEPLOYMENT", dseq: payload.dseq, walletId: payload.walletId });

    await this.initialDeploymentFundingService.fundOnLeaseStarted({
      walletId: payload.walletId,
      address: payload.address,
      dseq: payload.dseq
    });
  }
}

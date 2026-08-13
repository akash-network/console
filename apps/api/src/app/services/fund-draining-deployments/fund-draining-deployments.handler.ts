import { inject, singleton } from "tsyringe";

import { FundDrainingDeploymentsCommand } from "@src/billing/commands/fund-draining-deployments.command";
import type { JobHandler, JobPayload } from "@src/core";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";

@singleton()
export class FundDrainingDeploymentsHandler implements JobHandler<FundDrainingDeploymentsCommand> {
  public readonly accepts = FundDrainingDeploymentsCommand;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: FundDrainingDeploymentsHandler.name });
  }

  async handle(payload: JobPayload<FundDrainingDeploymentsCommand>): Promise<void> {
    this.logger.debug({ event: "FUND_DRAINING_DEPLOYMENTS", walletId: payload.walletId, address: payload.address });

    try {
      await this.topUpManagedDeploymentsService.topUpDrainingDeploymentsForOwner({
        walletId: payload.walletId,
        address: payload.address
      });
    } catch (error) {
      this.logger.error({ event: "FUND_DRAINING_DEPLOYMENTS_FAILED", walletId: payload.walletId, address: payload.address, error });
      throw error;
    }
  }
}

import { inject, singleton } from "tsyringe";

import { FundDrainingDeploymentsCommand } from "@src/billing/commands/fund-draining-deployments.command";
import type { JobHandler, JobPayload } from "@src/core";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { FundDrainingDeploymentsInstrumentationService } from "@src/deployment/services/top-up-managed-deployments/fund-draining-deployments-instrumentation.service";
import { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";

@singleton()
export class FundDrainingDeploymentsHandler implements JobHandler<FundDrainingDeploymentsCommand> {
  public readonly accepts = FundDrainingDeploymentsCommand;

  public readonly concurrency = 2;

  /**
   * With the per-wallet singletonKey on the command, the `singleton` policy keeps two top-ups for the
   * same wallet from funding its draining deployments concurrently (a plain `standard` queue ignores
   * singletonKey), while different wallets still run in parallel up to `concurrency`.
   */
  public readonly policy = "singleton";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly topUpManagedDeploymentsService: TopUpManagedDeploymentsService,
    private readonly instrumentation: FundDrainingDeploymentsInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: FundDrainingDeploymentsHandler.name });
  }

  async handle(payload: JobPayload<FundDrainingDeploymentsCommand>): Promise<void> {
    this.logger.debug({ event: "FUND_DRAINING_DEPLOYMENTS", walletId: payload.walletId, address: payload.address });

    const startTime = Date.now();

    try {
      await this.topUpManagedDeploymentsService.topUpDrainingDeploymentsForOwner({
        walletId: payload.walletId,
        address: payload.address
      });
      this.instrumentation.recordJobSucceeded(Date.now() - startTime);
    } catch (error) {
      this.instrumentation.recordJobFailed(Date.now() - startTime, error);
      throw error;
    }
  }
}

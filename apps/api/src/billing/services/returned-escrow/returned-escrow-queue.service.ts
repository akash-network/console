import { addSeconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { FundingWalletMoveRepository } from "@src/billing/repositories";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { CreditReturnedEscrow, creditReturnedEscrowKeyFor } from "./credit-returned-escrow.job";

/** Gives the chain index time to store the close before the first attempt, which fails and is retried when it has not. */
const INDEX_DELAY_IN_SECONDS = 60;

/** Asks for the credit of escrow a close just returned, kept apart from the service that credits it because that one signs through the service a close comes from. */
@singleton()
export class ReturnedEscrowQueueService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly fundingWalletMoveRepository: FundingWalletMoveRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ReturnedEscrowQueueService.name });
  }

  /** Queues nothing for a user wallet that was never moved off a funding wallet, and never fails the close it follows. */
  async queueAfterClose(userWalletId: number, closeTxHash: string): Promise<void> {
    try {
      const network = this.coreConfigService.get("NETWORK");
      const moves = await this.fundingWalletMoveRepository.findCompletedOf(userWalletId, network);

      if (moves.length === 0) return;

      await this.jobQueueService.enqueue(new CreditReturnedEscrow({ userWalletId, closeTxHash }), {
        singletonKey: creditReturnedEscrowKeyFor(network, userWalletId),
        startAfter: addSeconds(new Date(), INDEX_DELAY_IN_SECONDS)
      });
    } catch (error) {
      this.#logger.error({ event: "RETURNED_ESCROW_CREDIT_QUEUE_FAILED", userWalletId, closeTxHash, error });
    }
  }
}

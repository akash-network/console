import { inject, singleton } from "tsyringe";

import {
  MoveUserToActiveFundingWallet,
  moveUserToActiveFundingWalletKeyFor
} from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.job";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";

/** pg-boss runs a higher priority first: a user waiting on a refused top-up goes before the users whose deployments need their next top-up soonest, and those before the rest. */
export const FUNDING_WALLET_MOVE_PRIORITY = { rest: 0, hasOpenDeployment: 1, isWaiting: 2 } as const;

export type QueuedFundingWalletMove = {
  network: string;
  userWalletId: number;
  priority: (typeof FUNDING_WALLET_MOVE_PRIORITY)[keyof typeof FUNDING_WALLET_MOVE_PRIORITY];
  startAfter: Date;
};

/** Queues the move of a user wallet off the draining funding wallet, under one key per network and user wallet so its moves never run side by side. */
@singleton()
export class FundingWalletMoveQueueService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FundingWalletMoveQueueService.name });
  }

  async queue({ network, userWalletId, priority, startAfter }: QueuedFundingWalletMove): Promise<void> {
    await this.jobQueueService.enqueue(new MoveUserToActiveFundingWallet({ userWalletId }), {
      singletonKey: moveUserToActiveFundingWalletKeyFor(network, userWalletId),
      priority,
      startAfter
    });
  }

  /** Replaces the move this user wallet has queued, outside the caller's transaction, which the refusal that follows rolls back; a failure is logged and not thrown, so the caller still gets that refusal. */
  async queueAheadOfOthers(network: string, userWalletId: number): Promise<void> {
    const singletonKey = moveUserToActiveFundingWalletKeyFor(network, userWalletId);

    try {
      await this.txService.outsideTransaction(async () => {
        await this.jobQueueService.cancelCreatedBy({ name: MoveUserToActiveFundingWallet[JOB_NAME], singletonKey });
        await this.jobQueueService.enqueue(new MoveUserToActiveFundingWallet({ userWalletId }), {
          singletonKey,
          priority: FUNDING_WALLET_MOVE_PRIORITY.isWaiting
        });
      });
    } catch (error) {
      this.#logger.error({ event: "FUNDING_WALLET_MOVE_QUEUE_AHEAD_FAILED", network, userWalletId, error });
    }
  }
}

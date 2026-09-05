import { millisecondsInMinute } from "date-fns/constants";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { FundingClaim } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ReconcileManagedTx } from "./reconcile-managed-tx.handler";

/** An order of magnitude past the signer's unordered-tx TTL, so a transaction left undecided has either landed or expired by the time the chain is asked about it. */
const RECONCILE_DELAY_IN_MIN = 5;

export type ReconcileManagedTxTarget = {
  txHash: string;
  owner: string;
  claims: FundingClaim[];
};

@singleton()
export class ReconcileManagedTxJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ReconcileManagedTxJobService.name });
  }

  /** Keyed by the hash so two funding paths asking about the same transaction enqueue one job, not two. */
  static singletonKey(txHash: string): string {
    return `${ReconcileManagedTx[JOB_NAME]}.${txHash}`;
  }

  /** Never throws: the held claims are what prevent a second deposit, so losing this only costs the cooldown. */
  async schedule(target: ReconcileManagedTxTarget): Promise<void> {
    try {
      await this.jobQueueService.enqueue(new ReconcileManagedTx(target), {
        singletonKey: ReconcileManagedTxJobService.singletonKey(target.txHash),
        startAfter: new Date(Date.now() + RECONCILE_DELAY_IN_MIN * millisecondsInMinute).toISOString()
      });
    } catch (error: unknown) {
      this.logger.error({ event: "MANAGED_TX_RECONCILE_SCHEDULE_FAILED", txHash: target.txHash, owner: target.owner, error });
    }
  }
}

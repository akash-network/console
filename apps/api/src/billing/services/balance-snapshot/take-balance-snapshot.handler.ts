import { inject, singleton } from "tsyringe";

import { nextBalanceSnapshotRunAt, utcDayOf } from "@src/billing/lib/balance-snapshot-schedule/balance-snapshot-schedule";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { BalanceSnapshotService } from "./balance-snapshot.service";
import { TakeBalanceSnapshot, takeBalanceSnapshotKeyFor } from "./take-balance-snapshot.job";

@singleton()
export class TakeBalanceSnapshotHandler implements JobHandler<TakeBalanceSnapshot> {
  public readonly accepts = TakeBalanceSnapshot;

  /** With the singletonKey of each day, keeps every replica's seed from queueing a second snapshot. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly balanceSnapshotService: BalanceSnapshotService,
    private readonly jobQueueService: JobQueueService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: TakeBalanceSnapshotHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async scheduleNextRun(now: Date): Promise<void> {
    const runAt = nextBalanceSnapshotRunAt(now);
    const takenOn = utcDayOf(runAt);

    await this.jobQueueService.enqueue(new TakeBalanceSnapshot({ takenOn }), {
      singletonKey: takeBalanceSnapshotKeyFor(this.coreConfigService.get("NETWORK"), takenOn),
      startAfter: runAt.toISOString()
    });
  }

  /** Every replica seeds on boot, so a failure here waits for the next boot rather than keeping the workers down. */
  async seedNextRun(now: Date): Promise<void> {
    try {
      await this.scheduleNextRun(now);
    } catch (error) {
      this.#logger.error({ event: "BALANCE_SNAPSHOT_SCHEDULE_FAILED", error });
    }
  }

  /** The next day is queued before this one is read, so a snapshot that fails every retry does not end the daily run. */
  async handle({ takenOn }: JobPayload<TakeBalanceSnapshot>): Promise<void> {
    await this.scheduleNextRun(new Date());
    await this.balanceSnapshotService.take(takenOn);
  }
}

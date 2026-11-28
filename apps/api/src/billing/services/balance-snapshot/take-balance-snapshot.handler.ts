import { inject, singleton } from "tsyringe";

import { balanceSnapshotRunAtOn, nextBalanceSnapshotRunAt, utcDayAfter, utcDayOf } from "@src/billing/lib/balance-snapshot-schedule/balance-snapshot-schedule";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { BalanceSnapshotService } from "./balance-snapshot.service";
import { TakeBalanceSnapshot, takeBalanceSnapshotKeyFor } from "./take-balance-snapshot.job";

/** pg-boss retries a job still active past its expiry, 15 minutes by default, and that retry would wipe the pages the first run is still storing. */
const MAX_SNAPSHOT_RUN_SECONDS = 60 * 60;

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
    await this.#scheduleRunOn(utcDayOf(nextBalanceSnapshotRunAt(now)));
  }

  async #scheduleRunOn(takenOn: string): Promise<void> {
    await this.jobQueueService.enqueue(new TakeBalanceSnapshot({ takenOn }), {
      singletonKey: takeBalanceSnapshotKeyFor(this.coreConfigService.get("NETWORK"), takenOn),
      startAfter: balanceSnapshotRunAtOn(takenOn).toISOString(),
      expireInSeconds: MAX_SNAPSHOT_RUN_SECONDS
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

  /** The day after this one is queued before this one is read, so neither a snapshot that fails every retry nor one that runs days late leaves a day without a run. */
  async handle({ takenOn }: JobPayload<TakeBalanceSnapshot>): Promise<void> {
    await this.#scheduleRunOn(utcDayAfter(takenOn));
    await this.balanceSnapshotService.take(takenOn);
  }
}

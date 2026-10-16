import { inject, singleton } from "tsyringe";

import { decodeActivityCursor, encodeActivityCursor } from "@src/activity/lib/activity-cursor/activity-cursor";
import type { ActivityStatus, ActivityType, NewActivity } from "@src/activity/model-schemas";
import { type ActivityOutput, ActivityRepository, type ActivitySelection, isDedupeKeyTaken } from "@src/activity/repositories/activity/activity.repository";
import { ActivityInstrumentationService } from "@src/activity/services/activity-instrumentation/activity-instrumentation.service";
import { PurgeExpiredActivities, purgeExpiredActivitiesOptionsFor } from "@src/activity/services/purge-expired-activities/purge-expired-activities.job";
import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";

export type ActivityPage = { activities: ActivityOutput[]; hasMore: boolean; nextCursor: string | null };

type ActivityOutcome = Pick<NewActivity, "status" | "meta" | "dedupeKey">;

@singleton()
export class ActivityService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly authService: AuthService,
    private readonly jobQueueService: JobQueueService,
    private readonly activityInstrumentation: ActivityInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ActivityService.name });
  }

  /** The action has already happened by the time it is recorded, so a failed write is logged rather than failing the request that performed it. */
  async record(activity: NewActivity): Promise<void> {
    try {
      const recorded = await this.activityRepository.createUnlessDuplicate(activity);
      if (recorded) this.activityInstrumentation.trackRecorded(recorded);
      else this.#logger.info({ event: "ACTIVITY_RECORD_DEDUPED", userId: activity.userId, type: activity.type, dedupeKey: activity.dedupeKey });
    } catch (error) {
      this.#logger.error({ event: "ACTIVITY_RECORD_FAILED", userId: activity.userId, type: activity.type, status: activity.status, error });
    }

    await this.#keepPurgeQueued();
  }

  /** Not best-effort, unlike `record`: an activity opened for work still to come must fail the transaction that queues that work, including when another row already holds its dedupe key. */
  async open(activity: NewActivity & { id: string }): Promise<void> {
    await this.activityRepository.create(activity);
    this.activityInstrumentation.trackOpened(activity);
    await this.#keepPurgeQueued();
  }

  /** Every write to the feed queues the next purge, which queues nothing while one is already waiting; failing to queue it must never fail the write. */
  async #keepPurgeQueued(): Promise<void> {
    try {
      await this.jobQueueService.enqueue(new PurgeExpiredActivities(), purgeExpiredActivitiesOptionsFor(new Date()));
    } catch (error) {
      this.#logger.error({ event: "ACTIVITY_PURGE_QUEUE_FAILED", error });
    }
  }

  async isPending(id: string): Promise<boolean> {
    return (await this.activityRepository.findById(id))?.status === "pending";
  }

  async findByDedupeKey(userId: string, dedupeKey: string): Promise<ActivityOutput | undefined> {
    return await this.activityRepository.findOneBy({ userId, dedupeKey });
  }

  /** Guarded on `pending` unless told otherwise, so a late or repeated settle never overwrites an outcome already recorded; when another row already holds the dedupe key, the row still settles without it. */
  async settle(id: string, outcome: ActivityOutcome, { from = ["pending"] }: { from?: ActivityStatus[] } = {}): Promise<void> {
    const settled = await this.#writeOutcome(id, outcome, from);
    if (settled) this.activityInstrumentation.trackSettled(settled);
  }

  async #writeOutcome(id: string, { status, meta, dedupeKey }: ActivityOutcome, from: ActivityStatus[]): Promise<ActivityOutput | undefined> {
    try {
      return await this.activityRepository.updateByIdIfStatusIn(id, from, { status, meta, dedupeKey });
    } catch (error) {
      if (!isDedupeKeyTaken(error)) throw error;
      this.#logger.info({ event: "ACTIVITY_SETTLE_DEDUPED", activityId: id, status, dedupeKey });
      return await this.activityRepository.updateByIdIfStatusIn(id, from, { status, meta, dedupeKey: null });
    }
  }

  async list({ limit, cursor, status, type }: { limit: number; cursor?: string; status?: ActivityStatus; type?: ActivityType }): Promise<ActivityPage> {
    const after = cursor ? decodeActivityCursor(cursor) : undefined;
    const rows = await this.activityRepository.accessibleBy(this.authService.ability, "read").findPage({ limit: limit + 1, after, status, type });
    const activities = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    return { activities, hasMore, nextCursor: hasMore ? encodeActivityCursor(activities[activities.length - 1]) : null };
  }

  async findById(id: string): Promise<ActivityOutput | undefined> {
    return await this.activityRepository.accessibleBy(this.authService.ability, "read").findById(id);
  }

  async countUnseen(): Promise<number> {
    return await this.activityRepository.accessibleBy(this.authService.ability, "read").countUnseen();
  }

  async markSeen(selection: ActivitySelection): Promise<number> {
    await this.activityRepository.accessibleBy(this.authService.ability, "update").markSeen(selection);
    return await this.countUnseen();
  }
}

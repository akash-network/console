import { inject, singleton } from "tsyringe";

import { decodeActivityCursor, encodeActivityCursor } from "@src/activity/lib/activity-cursor/activity-cursor";
import type { ActivityStatus, ActivityType, NewActivity } from "@src/activity/model-schemas";
import { type ActivityOutput, ActivityRepository, type ActivitySelection } from "@src/activity/repositories/activity/activity.repository";
import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";

export type ActivityPage = { activities: ActivityOutput[]; hasMore: boolean; nextCursor: string | null };

@singleton()
export class ActivityService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ActivityService.name });
  }

  /** The action has already happened by the time it is recorded, so a failed write is logged rather than failing the request that performed it. */
  async record(activity: NewActivity): Promise<void> {
    try {
      await this.activityRepository.create(activity);
    } catch (error) {
      this.#logger.error({ event: "ACTIVITY_RECORD_FAILED", userId: activity.userId, type: activity.type, status: activity.status, error });
    }
  }

  /** Not best-effort, unlike `record`: an activity opened for work still to come must fail the transaction that queues that work. */
  async open(activity: NewActivity & { id: string }): Promise<void> {
    await this.activityRepository.create(activity);
  }

  async findLatest(query: { userId: string; type: ActivityType; dseq: string }): Promise<ActivityOutput | undefined> {
    return await this.activityRepository.findLatestByDseq(query);
  }

  async isPending(id: string): Promise<boolean> {
    return (await this.activityRepository.findById(id))?.status === "pending";
  }

  /** Guarded on `pending`, so a late or repeated settle never overwrites an outcome already recorded. */
  async settle(id: string, { status, meta }: Pick<NewActivity, "status" | "meta">): Promise<void> {
    await this.activityRepository.updateBy({ id, status: "pending" }, { status, meta });
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

import createError, { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { decodeActivityCursor, encodeActivityCursor } from "@src/activity/lib/activity-cursor/activity-cursor";
import type { ActivityStatus, ActivityType, AlertActivityType, NewActivity } from "@src/activity/model-schemas";
import {
  type ActivityOutput,
  ActivityRepository,
  type ActivitySelection,
  isDedupeKeyTaken,
  isUnknownUser
} from "@src/activity/repositories/activity/activity.repository";
import { ActivityInstrumentationService } from "@src/activity/services/activity-instrumentation/activity-instrumentation.service";
import { PurgeExpiredActivities, purgeExpiredActivitiesOptionsFor } from "@src/activity/services/purge-expired-activities/purge-expired-activities.job";
import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { isProjectInScope, readableProjectIdsOf } from "@src/organization/lib/project-scope/project-scope";
import { OrganizationContextResolver } from "@src/organization/services/organization-context/organization-context.resolver";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories/user/user.repository";

export type ActivityPage = { activities: ActivityOutput[]; hasMore: boolean; nextCursor: string | null };

type ActivityOutcome = Pick<NewActivity, "status" | "meta" | "dedupeKey">;

export type NewAlertActivity = Pick<NewActivity, "userId" | "meta"> & {
  organizationId: string | null;
  projectId: string | null;
  type: AlertActivityType;
  status: "info";
  dedupeKey: string;
};

@singleton()
export class ActivityService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly authService: AuthService,
    private readonly jobQueueService: JobQueueService,
    private readonly activityInstrumentation: ActivityInstrumentationService,
    private readonly organizationContextResolver: OrganizationContextResolver,
    private readonly userRepository: UserRepository,
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

  /** Never displaces a row already holding the dedupe key, so a repeated alert stays one entry and a close row keeps the key its deployment-closed alert reports. */
  async addAlert({ organizationId, projectId, ...alert }: NewAlertActivity): Promise<void> {
    if (organizationId && !(await this.#canStillSee(alert.userId, organizationId, projectId))) {
      this.#logger.info({
        event: "ACTIVITY_ALERT_OUT_OF_REACH",
        userId: alert.userId,
        organizationId,
        projectId,
        type: alert.type,
        alertId: alert.meta.alertId
      });
      return;
    }

    try {
      const added = await this.activityRepository.createUnlessDuplicate({ ...alert, initiator: "system" });
      if (added) this.activityInstrumentation.trackRecorded(added);
      else this.#logger.info({ event: "ACTIVITY_ALERT_DEDUPED", userId: alert.userId, type: alert.type, dedupeKey: alert.dedupeKey });
    } catch (error) {
      if (isUnknownUser(error)) throw createError(404, "User not found");
      throw error;
    }

    await this.#keepPurgeQueued();
  }

  async #canStillSee(userId: string, organizationId: string, projectId: string | null): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw createError(404, "User not found");

    const context = await this.#contextIn(user, organizationId);

    return !!context && isProjectInScope(projectId, context.projectScope, readableProjectIdsOf);
  }

  async #contextIn(user: UserOutput, organizationId: string): Promise<OrganizationContext | undefined> {
    try {
      return await this.organizationContextResolver.resolveBoundTo(user, organizationId);
    } catch (error) {
      if (isHttpError(error) && error.errorCode === ORGANIZATION_FORBIDDEN_ERROR_CODE) return undefined;
      throw error;
    }
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

  /** A later attempt at the same action on the same deployment that succeeded answers what this pending one left open. */
  async isOvertakenBySuccess(id: string): Promise<boolean> {
    const activity = await this.activityRepository.findById(id);
    if (!activity?.meta.dseq) return false;

    return await this.activityRepository.hasSucceededSince({
      userId: activity.userId,
      type: activity.type,
      dseq: activity.meta.dseq,
      since: activity.createdAt
    });
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

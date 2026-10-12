import createError from "http-errors";
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
import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY, TxService } from "@src/core";

export type ActivityPage = { activities: ActivityOutput[]; hasMore: boolean; nextCursor: string | null };

export type NewAlertActivity = Pick<NewActivity, "userId" | "meta"> & { type: AlertActivityType; status: "info"; dedupeKey: string };

@singleton()
export class ActivityService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ActivityService.name });
  }

  /** The action has already happened by the time it is recorded, so a failed write is logged rather than failing the request that performed it. */
  async record(activity: NewActivity): Promise<void> {
    try {
      const recorded = await this.#replacingClosedAlert(activity, async () => await this.activityRepository.createUnlessDuplicate(activity));
      if (!recorded) this.#logger.info({ event: "ACTIVITY_RECORD_DEDUPED", userId: activity.userId, type: activity.type, dedupeKey: activity.dedupeKey });
    } catch (error) {
      this.#logger.error({ event: "ACTIVITY_RECORD_FAILED", userId: activity.userId, type: activity.type, status: activity.status, error });
    }
  }

  /** Never displaces a row already holding the dedupe key, so a repeated alert stays one entry and a close row keeps the key its deployment-closed alert reports. */
  async addAlert(alert: NewAlertActivity): Promise<void> {
    try {
      const added = await this.activityRepository.createUnlessDuplicate({ ...alert, initiator: "system" });
      if (!added) this.#logger.info({ event: "ACTIVITY_ALERT_DEDUPED", userId: alert.userId, type: alert.type, dedupeKey: alert.dedupeKey });
    } catch (error) {
      if (isUnknownUser(error)) throw createError(404, "User not found");
      throw error;
    }
  }

  /** Not best-effort, unlike `record`: an activity opened for work still to come must fail the transaction that queues that work, including when another row already holds its dedupe key. */
  async open(activity: NewActivity & { id: string }): Promise<void> {
    await this.activityRepository.create(activity);
  }

  async isPending(id: string): Promise<boolean> {
    return (await this.activityRepository.findById(id))?.status === "pending";
  }

  async findByDedupeKey(userId: string, dedupeKey: string): Promise<ActivityOutput | undefined> {
    return await this.activityRepository.findOneBy({ userId, dedupeKey });
  }

  /** Guarded on `pending` unless told otherwise, so a late or repeated settle never overwrites an outcome already recorded nor deletes an alert for nothing; another close holding the dedupe key leaves the row to settle without it. */
  async settle(
    id: string,
    { userId, status, meta, dedupeKey }: Pick<NewActivity, "userId" | "status" | "meta" | "dedupeKey">,
    { from = ["pending"] }: { from?: ActivityStatus[] } = {}
  ): Promise<void> {
    const settleHolding = async (heldKey: string | null) => await this.activityRepository.updateByIdIfStatusIn(id, from, { status, meta, dedupeKey: heldKey });

    if (!(await this.#isRefusedForTakenKey(() => settleHolding(dedupeKey)))) return;
    if (!(await this.#isRefusedForTakenKey(() => this.#replacingClosedAlert({ userId, dedupeKey }, () => settleHolding(dedupeKey))))) return;

    this.#logger.info({ event: "ACTIVITY_SETTLE_DEDUPED", activityId: id, status, dedupeKey });
    await settleHolding(null);
  }

  async #isRefusedForTakenKey(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      return false;
    } catch (error) {
      if (isDedupeKeyTaken(error)) return true;
      throw error;
    }
  }

  /** The close takes the dedupe key from a deployment-closed alert that reported it first, because only the close says who closed the deployment and why. */
  async #replacingClosedAlert<T>({ userId, dedupeKey }: Pick<NewActivity, "userId" | "dedupeKey">, write: () => Promise<T>): Promise<T> {
    if (!dedupeKey) return await write();

    return await this.txService.transaction(async () => {
      await this.activityRepository.deleteBy({ userId, dedupeKey, type: "deployment_closed_alert" });
      return await write();
    });
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

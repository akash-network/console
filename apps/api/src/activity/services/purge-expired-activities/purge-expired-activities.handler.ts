import { subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { type CreateLogger, type JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { ACTIVITY_RETENTION_DAYS, PURGE_EXPIRED_ACTIVITIES_BATCH_SIZE, PurgeExpiredActivities } from "./purge-expired-activities.job";

@singleton()
export class PurgeExpiredActivitiesHandler implements JobHandler<PurgeExpiredActivities> {
  public readonly accepts = PurgeExpiredActivities;

  /** One waiting purge for the whole feed, so every write after the one that queued it queues nothing. */
  public readonly policy = "short";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly activityRepository: ActivityRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: PurgeExpiredActivitiesHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A pending activity is kept whatever its age, since the jobs closing its deployment settle it by id and it holds that close's dedupe key. */
  async handle(): Promise<void> {
    const createdBefore = subHours(new Date(), ACTIVITY_RETENTION_DAYS * 24);
    let purged = 0;

    while (true) {
      const deleted = await this.activityRepository.deleteSettledCreatedBefore(createdBefore, PURGE_EXPIRED_ACTIVITIES_BATCH_SIZE);
      purged += deleted;
      if (deleted < PURGE_EXPIRED_ACTIVITIES_BATCH_SIZE) break;
    }

    this.#logger.info({ event: "EXPIRED_ACTIVITIES_PURGED", createdBefore: createdBefore.toISOString(), purged });
  }
}

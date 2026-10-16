import { addHours } from "date-fns";

import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

export const ACTIVITY_RETENTION_DAYS = 90;

export const PURGE_EXPIRED_ACTIVITIES_BATCH_SIZE = 1000;

export const PURGE_EXPIRED_ACTIVITIES_INTERVAL_IN_HOURS = 24;

export const PURGE_EXPIRED_ACTIVITIES_KEY = "purgeExpiredActivities";

/** Deletes every user's settled activities older than the retention window; writes to the feed keep the next run queued. */
export class PurgeExpiredActivities implements Job {
  static readonly [JOB_NAME] = "PurgeExpiredActivities";
  readonly name = PurgeExpiredActivities[JOB_NAME];
  readonly version = 1;
  readonly data: Record<string, never> = {};
}

const PURGE_EXPIRED_ACTIVITIES_RETRY_OPTIONS = {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 60,
  retryDelayMax: 60 * 60
} satisfies EnqueueOptions;

export function purgeExpiredActivitiesOptionsFor(now: Date): EnqueueOptions {
  return {
    singletonKey: PURGE_EXPIRED_ACTIVITIES_KEY,
    startAfter: addHours(now, PURGE_EXPIRED_ACTIVITIES_INTERVAL_IN_HOURS).toISOString(),
    ...PURGE_EXPIRED_ACTIVITIES_RETRY_OPTIONS
  };
}

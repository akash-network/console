import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Emails the user about the account status change an admin recorded as this event. */
export class NotifyAccountStatusChange implements Job {
  static readonly [JOB_NAME] = "NotifyAccountStatusChange";
  readonly name = NotifyAccountStatusChange[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { eventId: string }) {}
}

export function notifyAccountStatusChangeKeyFor(eventId: string): string {
  return `notifyAccountStatusChange.${eventId}`;
}

/** Outlasts a notifications outage of a couple of hours, since this email is the only notice the user gets of the status change. */
export const NOTIFY_ACCOUNT_STATUS_CHANGE_RETRY_OPTIONS = {
  retryLimit: 10,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 30 * 60
} satisfies EnqueueOptions;

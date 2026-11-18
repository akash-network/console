import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

export type TemplatePublisherNoticeSource =
  | { source: "moderation"; eventId: string }
  | { source: "version_failed_checks"; versionId: string; savedByUserId: string }
  | { source: "version_held"; versionId: string };

/** Tells a template's publisher, by email and in the app, what staff or the publish checks decided about it. */
export class NotifyTemplatePublishers implements Job {
  static readonly [JOB_NAME] = "NotifyTemplatePublishers";
  readonly name = NotifyTemplatePublishers[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: TemplatePublisherNoticeSource) {}
}

export function notifyTemplatePublishersKeyFor(notice: TemplatePublisherNoticeSource): string {
  return `notifyTemplatePublishers.${notice.source}.${"eventId" in notice ? notice.eventId : notice.versionId}`;
}

/** Outlasts a notifications outage of a couple of hours, since this notice is all the publisher hears of the outcome. */
export const NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS = {
  retryLimit: 10,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 30 * 60
} satisfies EnqueueOptions;

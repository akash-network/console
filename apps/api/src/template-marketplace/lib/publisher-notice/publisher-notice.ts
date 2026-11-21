import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import type { TemplateModerationAction } from "@src/template-marketplace/model-schemas/template-moderation-event/template-moderation-event.schema";

export const PUBLISHER_NOTICE_KINDS = [
  "version_approved",
  "version_rejected",
  "version_failed_checks",
  "version_held",
  "template_hidden",
  "template_unhidden",
  "template_removed",
  "template_promoted_official",
  "template_removed_official",
  "publisher_suspended",
  "publisher_reinstated"
] as const;

export type PublisherNoticeKind = (typeof PUBLISHER_NOTICE_KINDS)[number];

const NOTICE_KIND_BY_ACTION: Partial<Record<TemplateModerationAction, PublisherNoticeKind>> = {
  approve_version: "version_approved",
  reject_version: "version_rejected",
  hide: "template_hidden",
  unhide: "template_unhidden",
  remove: "template_removed",
  promote_official: "template_promoted_official",
  remove_official: "template_removed_official",
  suspend_publisher: "publisher_suspended",
  reinstate_publisher: "publisher_reinstated"
};

/** Staff actions a publisher has nothing to act on, such as featuring a template or editing its categories, tell the publisher nothing. */
export function publisherNoticeKindOf(action: TemplateModerationAction): PublisherNoticeKind | undefined {
  return NOTICE_KIND_BY_ACTION[action];
}

export const MAX_ISSUES_IN_NOTICE = 5;

/** What the failed checks said, in the order the checks ran, for a notice that has no room for all of a long list. */
export function failedCheckMessagesOf(checkResults: PublishCheckResults | null): string[] {
  const messages = (checkResults?.checks ?? []).filter(check => check.status === "failed").flatMap(check => check.issues.map(issue => issue.message));
  const hiddenCount = messages.length - MAX_ISSUES_IN_NOTICE;

  return hiddenCount > 0 ? [...messages.slice(0, MAX_ISSUES_IN_NOTICE), `And ${hiddenCount} more.`] : messages;
}

export const PUBLISH_CHECK_KEYS = ["sdl_valid", "no_secrets", "images_allowed", "fixed_tags", "name_not_reserved"] as const;

export type PublishCheckKey = (typeof PUBLISH_CHECK_KEYS)[number];

export const PUBLISH_CHECK_STATUSES = ["passed", "failed"] as const;

export type PublishCheckStatus = (typeof PUBLISH_CHECK_STATUSES)[number];

export const PUBLISH_CHECK_ISSUE_FIELDS = ["title", "publisher_name"] as const;

export type PublishCheckIssueField = (typeof PUBLISH_CHECK_ISSUE_FIELDS)[number];

export type PublishCheckIssue = {
  message: string;
  service?: string;
  variable?: string;
  image?: string;
  field?: PublishCheckIssueField;
};

export type PublishCheck = { key: PublishCheckKey; status: PublishCheckStatus; issues: PublishCheckIssue[] };

export type PublishCheckResults = { ranAt: string; checks: PublishCheck[] };

export function toPublishCheck(key: PublishCheckKey, issues: PublishCheckIssue[]): PublishCheck {
  return { key, status: issues.length === 0 ? "passed" : "failed", issues };
}

export function hasPassedPublishChecks({ checks }: Pick<PublishCheckResults, "checks">): boolean {
  return checks.every(check => check.status === "passed");
}

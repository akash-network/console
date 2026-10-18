import type { Activity } from "@src/queries/useLatestActivitiesQuery";

/** A summary naming more deployments than this gets too long to read, so the rest are counted instead. */
const MAX_LISTED_DEPLOYMENTS = 3;

type SystemCloseReason = NonNullable<Activity["meta"]["reason"]>;

const SYSTEM_CLOSE_REASONS = new Map<string | undefined, string>(
  Object.entries({
    runtime_limit_reached: "It reached its runtime limit.",
    trial_ended: "It reached the time limit for trial deployments.",
    provider_unreachable: "Its provider stopped responding.",
    no_lease: "It never got a lease, so its deposit was returned."
  } satisfies Record<SystemCloseReason, string>)
);

export function deploymentLabelOf(name: string | null, dseq: string | undefined): string {
  return name ? `“${name}”` : `deployment ${dseq}`;
}

export function listOf(labels: string[]): string {
  if (labels.length > MAX_LISTED_DEPLOYMENTS) return `${labels.slice(0, MAX_LISTED_DEPLOYMENTS).join(", ")} and ${labels.length - MAX_LISTED_DEPLOYMENTS} more`;

  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** The api can close for a reason added after this app was built, which then reads as a plain close. */
export function systemCloseOf(deployment: string, reason: string | undefined): { title: string; detail: string } {
  return { title: `Console closed ${deployment}`, detail: SYSTEM_CLOSE_REASONS.get(reason) ?? "It no longer runs or costs anything." };
}

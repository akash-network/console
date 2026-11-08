import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Closes what a terminated account still runs, stops its auto-recharge and, when the admin chose to, forfeits its credits. */
export class ApplyAccountTermination implements Job {
  static readonly [JOB_NAME] = "ApplyAccountTermination";
  readonly name = ApplyAccountTermination[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userId: string; forfeitCredits: boolean }) {}
}

export function applyAccountTerminationKeyFor(userId: string): string {
  return `applyAccountTermination.${userId}`;
}

/** An escrow that cannot settle yet fails the run, so the backoff keeps retrying for about half an hour. */
export const APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS = {
  retryLimit: 8,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

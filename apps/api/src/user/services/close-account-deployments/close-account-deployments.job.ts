import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Closes every deployment of a user's personal wallet after an admin suspended the account and asked for them to be closed. */
export class CloseAccountDeployments implements Job {
  static readonly [JOB_NAME] = "CloseAccountDeployments";
  readonly name = CloseAccountDeployments[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { userId: string }) {}
}

export function closeAccountDeploymentsKeyFor(userId: string): string {
  return `closeAccountDeployments.${userId}`;
}

/** An escrow that cannot settle yet fails the run, so the backoff keeps retrying for about half an hour. */
export const CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS = {
  retryLimit: 8,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

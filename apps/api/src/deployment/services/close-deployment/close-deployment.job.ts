import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Closes a deployment a user asked to close in the background, and settles the activity the request opened for it. */
export class CloseDeployment implements Job {
  static readonly [JOB_NAME] = "CloseDeployment";
  readonly name = CloseDeployment[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      dseq: string;
      activityId: string;
      batchId?: string;
      /** Names the wallet to close with when it belongs to an organization, which the job cannot resolve from the user. */
      walletId?: number;
    }
  ) {}
}

/** One key per deployment, so a second request while a close is queued or running joins it rather than queueing another. */
export function closeDeploymentKeyFor({ userId, dseq }: { userId: string; dseq: string }): string {
  return `closeDeployment.${userId}.${dseq}`;
}

/** Eight retries backing off from 30 s to a 5 min cap keep a close trying for about half an hour before it is recorded as failed. */
export const CLOSE_DEPLOYMENT_RETRY_OPTIONS = {
  retryLimit: 8,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

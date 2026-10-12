import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Applies a deployment update a request already saved, and settles the activity the request opened for it. */
export class ApplyDeploymentUpdate implements Job {
  static readonly [JOB_NAME] = "ApplyDeploymentUpdate";
  readonly name = ApplyDeploymentUpdate[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      dseq: string;
      /** The saved version this job applies, so a job a newer save replaced applies nothing. */
      manifestVersion: string;
      activityId: string;
    }
  ) {}
}

/** One key per deployment, so the applies of one deployment run one at a time while those of others run beside them. */
export function applyDeploymentUpdateKeyFor({ userId, dseq }: { userId: string; dseq: string }): string {
  return `applyDeploymentUpdate.${userId}.${dseq}`;
}

/** Eight retries backing off from 30 s to a 5 min cap keep an update trying for about half an hour before it is recorded as failed. */
export const APPLY_DEPLOYMENT_UPDATE_RETRY_OPTIONS = {
  retryLimit: 8,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

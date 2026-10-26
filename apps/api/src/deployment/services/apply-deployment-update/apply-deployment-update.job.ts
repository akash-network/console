import type { DeploymentChanges } from "@src/activity/model-schemas";
import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Applies a deployment update a request already saved, and settles the activity the request opened for it. */
export class ApplyDeploymentUpdate implements Job {
  static readonly [JOB_NAME] = "ApplyDeploymentUpdate";
  readonly name = ApplyDeploymentUpdate[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      /** The member who saved the update, whose feed reports it. */
      userId: string;
      dseq: string;
      /** The saved version this job applies, so a job a newer save replaced applies nothing. */
      manifestVersion: string;
      /** The wallet the request resolved, which a job cannot find again from the member once it belongs to an organization. */
      walletId: number;
      /** Absent for a deployment filed before organizations, whose row only its user reaches. */
      organizationId?: string;
      activityId: string;
      /** Absent for a job queued before changes were recorded, whose activity then settles without them. */
      changes?: DeploymentChanges;
    }
  ) {}
}

/** One key per deployment of a wallet, so the applies of one deployment run one at a time while those of others, including a same dseq held by another wallet, run beside them. */
export function applyDeploymentUpdateKeyFor({ walletId, dseq }: { walletId: number; dseq: string }): string {
  return `applyDeploymentUpdate.${walletId}.${dseq}`;
}

/** Eight retries backing off from 30 s to a 5 min cap keep an update trying for about half an hour before it is recorded as failed. */
export const APPLY_DEPLOYMENT_UPDATE_RETRY_OPTIONS = {
  retryLimit: 8,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

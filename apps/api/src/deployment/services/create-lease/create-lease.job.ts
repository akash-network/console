import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";
import type { LeasePlacement } from "@src/deployment/utils/lease-placement/lease-placement";

/** Creates the leases a user accepted in the background, sends their manifest, and settles the activity the request opened for them. */
export class CreateLease implements Job {
  static readonly [JOB_NAME] = "CreateLease";
  readonly name = CreateLease[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      leases: LeasePlacement[];
      activityId: string;
    }
  ) {}
}

/** One key per deployment, named by its owner's address as the chain names it, so a second request while one is queued or running joins it and the stale-deployment cleanup can tell which deployments are still getting their lease. */
export function createLeaseKeyFor({ owner, dseq }: { owner: string; dseq: string }): string {
  return `createLease.${owner}.${dseq}`;
}

/** Six retries backing off from 15 s to a 2 min cap keep trying for about ten minutes, by which time a bid has expired and a provider still refusing the manifest is not about to accept it. */
export const CREATE_LEASE_RETRY_OPTIONS = {
  retryLimit: 6,
  retryBackoff: true,
  retryDelay: 15,
  retryDelayMax: 2 * 60
} satisfies EnqueueOptions;

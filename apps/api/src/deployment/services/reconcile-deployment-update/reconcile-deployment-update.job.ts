import { addMinutes } from "date-fns";

import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Records what became of an update left pending: a request's update whose outcome was undecided, or a background update whose job was lost to a worker restart or ran out of retries on an undecided outcome. */
export class ReconcileDeploymentUpdate implements Job {
  static readonly [JOB_NAME] = "ReconcileDeploymentUpdate";
  readonly name = ReconcileDeploymentUpdate[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      owner: string;
      dseq: string;
      manifestVersion: string;
      activityId: string;
      /** Absent for an update the request applied itself, which has no job to wait for. */
      updateJobId?: string;
    }
  ) {}
}

/** An order of magnitude past the signer's unordered-tx TTL, so whatever the update job sent has landed or expired by the time the deployment is read. */
export const RECONCILE_DEPLOYMENT_UPDATE_DELAY_IN_MIN = 5;

/** Twelve retries backing off from 30 s to a 5 min cap keep reading through a node outage for about 50 minutes. */
const RECONCILE_DEPLOYMENT_UPDATE_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

export function reconcileDeploymentUpdateKeyFor(activityId: string): string {
  return `reconcileDeploymentUpdate.${activityId}`;
}

export function reconcileDeploymentUpdateOptionsFor(activityId: string, now: Date): EnqueueOptions {
  return {
    singletonKey: reconcileDeploymentUpdateKeyFor(activityId),
    startAfter: addMinutes(now, RECONCILE_DEPLOYMENT_UPDATE_DELAY_IN_MIN).toISOString(),
    ...RECONCILE_DEPLOYMENT_UPDATE_RETRY_OPTIONS
  };
}

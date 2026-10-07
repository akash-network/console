import { addMinutes } from "date-fns";

import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";

/** Records what became of a background close its job left pending, whether a worker restart lost the job or it ran out of retries on an undecided outcome. */
export class ReconcileDeploymentClose implements Job {
  static readonly [JOB_NAME] = "ReconcileDeploymentClose";
  readonly name = ReconcileDeploymentClose[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      owner: string;
      dseq: string;
      activityId: string;
      batchId?: string;
      closeJobId: string;
    }
  ) {}
}

/** An order of magnitude past the signer's unordered-tx TTL, so whatever the close job sent has landed or expired by the time the deployment is read. */
export const RECONCILE_DEPLOYMENT_CLOSE_DELAY_IN_MIN = 5;

/** Twelve retries backing off from 30 s to a 5 min cap keep reading through a node outage for about 50 minutes. */
const RECONCILE_DEPLOYMENT_CLOSE_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

export function reconcileDeploymentCloseOptionsFrom(now: Date): EnqueueOptions {
  return { startAfter: addMinutes(now, RECONCILE_DEPLOYMENT_CLOSE_DELAY_IN_MIN).toISOString(), ...RECONCILE_DEPLOYMENT_CLOSE_RETRY_OPTIONS };
}

import { addMinutes } from "date-fns";

import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";
import { CHAIN_PROGRESS_MARGIN_IN_MIN } from "@src/deployment/services/deployment-presence/deployment-presence.service";
import type { AcceptedDeploymentCreate } from "@src/deployment/services/deployment-writer/deployment-writer.service";

/** Records what became of a create left pending: a request's create whose outcome was undecided, or a background create whose job was lost or ran out of retries on an undecided outcome. */
export class ReconcileDeploymentCreate implements Job {
  static readonly [JOB_NAME] = "ReconcileDeploymentCreate";
  readonly name = ReconcileDeploymentCreate[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: AcceptedDeploymentCreate & {
      activityId: string;
      /** Absent for a create the request performed itself, which has no job to wait for. */
      createJobId?: string;
    }
  ) {}
}

/** The chain only proves a deployment absent once it is this far past the last create sent, so a check due sooner would spend its retries waiting. */
export const RECONCILE_DEPLOYMENT_CREATE_DELAY_IN_MIN = CHAIN_PROGRESS_MARGIN_IN_MIN;

/** Twelve retries backing off from 30 s to a 5 min cap keep reading through a node outage for about 50 minutes. */
const RECONCILE_DEPLOYMENT_CREATE_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

export function reconcileDeploymentCreateKeyFor(activityId: string): string {
  return `reconcileDeploymentCreate.${activityId}`;
}

export function reconcileDeploymentCreateOptionsFor(activityId: string, now: Date): EnqueueOptions {
  return {
    singletonKey: reconcileDeploymentCreateKeyFor(activityId),
    startAfter: addMinutes(now, RECONCILE_DEPLOYMENT_CREATE_DELAY_IN_MIN).toISOString(),
    ...RECONCILE_DEPLOYMENT_CREATE_RETRY_OPTIONS
  };
}

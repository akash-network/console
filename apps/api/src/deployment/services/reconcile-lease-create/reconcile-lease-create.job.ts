import { addMinutes } from "date-fns";

import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";
import type { LeasePlacement } from "@src/deployment/utils/lease-placement/lease-placement";

/** Records what became of a lease left pending: a request's lease whose outcome was undecided, or a background lease whose job was lost to a worker restart or ran out of retries on an undecided outcome. */
export class ReconcileLeaseCreate implements Job {
  static readonly [JOB_NAME] = "ReconcileLeaseCreate";
  readonly name = ReconcileLeaseCreate[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      owner: string;
      leases: LeasePlacement[];
      activityId: string;
      /** Absent for a lease the request created itself, which has no job to wait for. */
      createLeaseJobId?: string;
    }
  ) {}
}

/** An order of magnitude past the signer's unordered-tx TTL, so whatever the lease job sent has landed or expired by the time the leases are read. */
export const RECONCILE_LEASE_CREATE_DELAY_IN_MIN = 5;

/** Twelve retries backing off from 30 s to a 5 min cap keep reading through a node outage for about 50 minutes. */
const RECONCILE_LEASE_CREATE_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
} satisfies EnqueueOptions;

export function reconcileLeaseCreateKeyFor(activityId: string): string {
  return `reconcileLeaseCreate.${activityId}`;
}

export function reconcileLeaseCreateOptionsFor(activityId: string, now: Date): EnqueueOptions {
  return {
    singletonKey: reconcileLeaseCreateKeyFor(activityId),
    startAfter: addMinutes(now, RECONCILE_LEASE_CREATE_DELAY_IN_MIN).toISOString(),
    ...RECONCILE_LEASE_CREATE_RETRY_OPTIONS
  };
}

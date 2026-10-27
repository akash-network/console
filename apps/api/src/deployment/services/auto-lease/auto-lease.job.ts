import { type EnqueueOptions, type Job, JOB_NAME } from "@src/core";
import type { LeaseWalletRef } from "@src/deployment/services/create-lease/create-lease.job";

/** Picks a one-click deployment's providers and hands them to the background lease, re-enqueueing itself until it can or gives up. */
export class AutoLease implements Job {
  static readonly [JOB_NAME] = "AutoLease";
  readonly name = AutoLease[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: LeaseWalletRef & {
      /** The member who asked for the deployment, whose feed the activity is in, whichever wallet signs. */
      userId: string;
      owner: string;
      dseq: string;
      activityId: string;
      /** When the match began, which the wait for a first bid counts from. */
      startedAt: string;
      /** When a first bid was seen, which the wait for a reachable bidder counts from. */
      firstBidAt?: string;
    }
  ) {}
}

/** Named by the owner's address as the chain names it, the way the lease job and the stale-deployment cleanup key a deployment. */
export function autoLeaseKeyFor({ owner, dseq }: { owner: string; dseq: string }): string {
  return `autoLease.${owner}.${dseq}`;
}

/** Retries cover a failed chain or provider read; the waits themselves are re-enqueues, not retries. */
export const AUTO_LEASE_RETRY_OPTIONS = {
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 5,
  retryDelayMax: 30
} satisfies EnqueueOptions;

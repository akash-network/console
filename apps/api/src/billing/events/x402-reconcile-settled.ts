import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

/**
 * Recurring background job that re-drives crediting for x402 transactions stranded in `settled`
 * (payment captured on-chain but wallet credit never applied). It carries no payload — each run
 * scans the whole backlog.
 */
export class X402ReconcileSettled implements Job {
  static readonly [JOB_NAME] = "x402-reconcile-settled";
  public readonly name = X402ReconcileSettled[JOB_NAME];
  public readonly version = 1;
  public readonly data: Record<string, never> = {};
}

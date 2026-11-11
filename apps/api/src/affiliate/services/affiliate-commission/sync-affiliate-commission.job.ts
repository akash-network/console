import { type Job, JOB_NAME } from "@src/core/services/job-queue/job-queue.service";

/** Only a settlement may grant a commission; a refund or a dispute only takes back one that exists, so a skipped grant stays skipped. */
export type AffiliateCommissionSyncTrigger = "settlement" | "refund" | "dispute";

export class SyncAffiliateCommission implements Job {
  static readonly [JOB_NAME] = "SyncAffiliateCommission";
  readonly name = SyncAffiliateCommission[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { transactionId: string; trigger: AffiliateCommissionSyncTrigger }) {}
}

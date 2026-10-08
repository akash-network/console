import { type Job, JOB_NAME } from "@src/core/services/job-queue/job-queue.service";

export class SyncAffiliateCommission implements Job {
  static readonly [JOB_NAME] = "SyncAffiliateCommission";
  readonly name = SyncAffiliateCommission[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { transactionId: string }) {}
}

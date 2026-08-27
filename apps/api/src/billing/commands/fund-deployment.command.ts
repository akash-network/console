import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

/**
 * A fresh lease is often not visible over chain REST for a few seconds, and the handler throws to
 * retry until it is. The queue's own retry pacing cannot be trusted for that: pg-boss defaults
 * retryDelay to 0, which collapses retryBackoff into instant retries that burn every attempt in
 * milliseconds and strand the deployment on its creation deposit until the hourly sweep. Sent with
 * every publish, these options give the job ~5s to ~160s of jittered backoff per attempt instead.
 */
export const FUND_DEPLOYMENT_RETRY_OPTIONS = {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 5,
  retryDelayMax: 300
} as const;

export class FundDeploymentCommand implements Job {
  static readonly [JOB_NAME] = "FundDeploymentCommand";

  public readonly name = FundDeploymentCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      address: string;
      dseq: string;
    }
  ) {}
}

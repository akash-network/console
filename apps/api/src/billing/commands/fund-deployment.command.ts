import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

/** pg-boss defaults retryDelay to 0, which would collapse retryBackoff into instant retries that burn every attempt in milliseconds. */
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

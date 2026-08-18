import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class FundDrainingDeploymentsCommand implements Job {
  static readonly [JOB_NAME] = "FundDrainingDeploymentsCommand";

  public readonly name = FundDrainingDeploymentsCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      address: string;
    }
  ) {}
}

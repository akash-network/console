import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class FundDeploymentCommand implements Job {
  static readonly [JOB_NAME] = "FundDeploymentCommand";

  public readonly name = FundDeploymentCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      walletId: number;
      address: string;
      dseq: string;
    }
  ) {}
}

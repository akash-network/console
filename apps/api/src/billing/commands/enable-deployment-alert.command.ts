import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class EnableDeploymentAlertCommand implements Job {
  static readonly [JOB_NAME] = "EnableDeploymentAlertCommand";

  public readonly name = EnableDeploymentAlertCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      walletAddress: string;
      dseq: string;
    }
  ) {}
}

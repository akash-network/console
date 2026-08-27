import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class CloseExpiredDeploymentCommand implements Job {
  static readonly [JOB_NAME] = "CloseExpiredDeploymentCommand";

  public readonly name = CloseExpiredDeploymentCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      deploymentSettingId: string;
      userId: string;
      dseq: string;
    }
  ) {}
}

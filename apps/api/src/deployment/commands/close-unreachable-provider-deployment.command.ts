import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class CloseUnreachableProviderDeploymentCommand implements Job {
  static readonly [JOB_NAME] = "CloseUnreachableProviderDeploymentCommand";

  public readonly name = CloseUnreachableProviderDeploymentCommand[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      owner: string;
      dseq: string;
    }
  ) {}
}

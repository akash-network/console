import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";

export class ActivateTrial implements Job {
  static readonly [JOB_NAME] = "ActivateTrial";
  public readonly name = ActivateTrial[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
    }
  ) {}
}

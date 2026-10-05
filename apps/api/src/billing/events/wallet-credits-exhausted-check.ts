import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";

export class WalletCreditsExhaustedCheck implements Job {
  static readonly [JOB_NAME] = "WalletCreditsExhaustedCheck";
  public readonly name = WalletCreditsExhaustedCheck[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      firstClosingDseq: string;
      unfundedDeploymentCount: number;
      firstClosureAt: string;
    }
  ) {}
}

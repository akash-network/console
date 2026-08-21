import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";

export class WalletCreditsLowCheck implements Job {
  static readonly [JOB_NAME] = "WalletCreditsLowCheck";
  public readonly name = WalletCreditsLowCheck[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
    }
  ) {}
}

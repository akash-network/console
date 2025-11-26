import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";

export class WalletBalanceReloadCheck implements Job {
  static readonly [JOB_NAME] = "WalletBalanceReloadCheck";
  public readonly name = WalletBalanceReloadCheck[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
    }
  ) {}
}

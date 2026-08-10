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
      /**
       * True when scheduled right after deployment activity (scheduleImmediate) rather than by the
       * periodic sweep. The fixed-threshold handler skips its no-active-deployments guard for these,
       * since the triggering deployment may not be in the indexer's Deployment table yet.
       */
      immediate?: boolean;
    }
  ) {}
}

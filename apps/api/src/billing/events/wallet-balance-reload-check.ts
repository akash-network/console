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
       * Set only when the check is scheduled right after a deployment's lease starts. The
       * fixed-threshold handler skips its no-active-deployments guard for these, since the
       * just-started deployment may not be in the indexer's Deployment table yet. Every other
       * scheduler (periodic sweep, settings lazy-create, spend events) leaves it unset so the
       * guard runs.
       */
      triggeredByDeployment?: boolean;
    }
  ) {}
}

import type { WalletBillingTarget } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";

export class WalletCreditsExhaustedCheck implements Job {
  static readonly [JOB_NAME] = "WalletCreditsExhaustedCheck";
  public readonly name = WalletCreditsExhaustedCheck[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: WalletBillingTarget & {
      firstClosingDseq: string;
      unfundedDeploymentCount: number;
      firstClosureAt: string;
    }
  ) {}
}

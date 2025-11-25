import { singleton } from "tsyringe";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { JobHandler } from "@src/core";

@singleton()
export class WalletBalanceReloadCheckHandler implements JobHandler<WalletBalanceReloadCheck> {
  public readonly accepts = WalletBalanceReloadCheck;

  public readonly concurrency = 10;

  public readonly policy = "short";

  constructor() {}

  async handle(): Promise<void> {}
}

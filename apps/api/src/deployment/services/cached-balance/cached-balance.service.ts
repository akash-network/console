import { singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";
import { memoizeAsync } from "@src/caching/helpers";

export class CachedBalance {
  constructor(private value: number) {}

  public reserveSufficientAmount(desiredAmount: number) {
    const value = Math.min(desiredAmount, this.value);

    if (value <= 0) {
      throw new Error(`Insufficient balance: ${this.value} < ${desiredAmount}`);
    }

    this.value -= value;

    return value;
  }
}

@singleton()
export class CachedBalanceService {
  public get = memoizeAsync((address: string) => this.buildForAddress(address), { cacheItemLimit: 10_000 });

  constructor(private readonly balancesService: BalancesService) {}

  /**
   * Reads a fresh balance bypassing the per-address memo. The memo is keyed for
   * the process lifetime, which suits the short-lived top-up cron but would serve
   * stale balances to the long-running background worker across credit landings.
   */
  public getFresh(address: string): Promise<CachedBalance> {
    return this.buildForAddress(address);
  }

  private async buildForAddress(address: string): Promise<CachedBalance> {
    const limits = await this.balancesService.getFreshLimits({ address });
    return new CachedBalance(limits.deployment);
  }
}

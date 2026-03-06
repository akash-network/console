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
  public get = memoizeAsync(
    async (address: string) => {
      const limits = await this.balancesService.getFreshLimits({ address });
      return new CachedBalance(limits.deployment);
    },
    { cacheItemLimit: 10_000 }
  );

  constructor(private readonly balancesService: BalancesService) {}
}

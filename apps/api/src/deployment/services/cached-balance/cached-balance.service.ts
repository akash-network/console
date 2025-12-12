import { singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";

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
  private readonly balanceCache = new Map<string, CachedBalance>();

  constructor(private readonly balancesService: BalancesService) {}

  public async get(address: string, isOldWallet: boolean = false): Promise<CachedBalance> {
    let cachedBalance = this.balanceCache.get(address);
    if (!cachedBalance) {
      const limits = await this.balancesService.getFreshLimits({ address, isOldWallet });
      cachedBalance = new CachedBalance(limits.deployment);
      this.balanceCache.set(address, cachedBalance);
    }

    return cachedBalance;
  }
}

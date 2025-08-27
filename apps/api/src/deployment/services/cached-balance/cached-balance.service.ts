import { singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";

class CachedBalance {
  constructor(private value: number) {}

  public reserveSufficientAmount(desiredAmount: number) {
    if (desiredAmount < 0) {
      throw new Error(`Invalid amount: ${desiredAmount}`);
    }

    if (desiredAmount > 0 && this.value === 0) {
      throw new Error(`Insufficient balance: ${this.value} < ${desiredAmount}`);
    }

    const reservedAmount = Math.min(desiredAmount, this.value);
    this.value -= reservedAmount;

    return reservedAmount;
  }
}

@singleton()
export class CachedBalanceService {
  private readonly balanceCache = new Map<string, CachedBalance>();

  constructor(private readonly balancesService: BalancesService) {}

  public async get(address: string): Promise<CachedBalance> {
    let cachedBalance = this.balanceCache.get(address);
    if (!cachedBalance) {
      const limits = await this.balancesService.getFreshLimits({ address });
      cachedBalance = new CachedBalance(limits.deployment);
      this.balanceCache.set(address, cachedBalance);
    }

    return cachedBalance;
  }
}

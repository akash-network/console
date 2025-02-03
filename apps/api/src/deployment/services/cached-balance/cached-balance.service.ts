import { singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";

class CachedBalance {
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

  public async get(address: string): Promise<CachedBalance> {
    if (this.balanceCache.has(address)) {
      return this.balanceCache.get(address);
    }

    const limits = await this.balancesService.getFreshLimits({ address });
    this.balanceCache.set(address, new CachedBalance(limits.deployment));

    return this.balanceCache.get(address);
  }
}

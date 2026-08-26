import { inject, singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";
import { memoizeAsync } from "@src/caching/helpers";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { denomToUdenom } from "@src/utils/math";

export class CachedBalance {
  readonly #available: number;
  readonly #headroomWaived: boolean;
  #spendable: number;

  /**
   * The headroom yields the moment the balance cannot cover it: keeping running deployments alive outranks
   * reserving room for a new one. It is resolved once, from the balance the funding pass started with, so a
   * batch cannot chip the floor away one deployment at a time.
   */
  constructor(available: number, headroom: number) {
    this.#available = available;
    this.#headroomWaived = headroom > 0 && available <= headroom;
    this.#spendable = available > headroom ? available - headroom : available;
  }

  public get available() {
    return this.#available;
  }

  public get spendable() {
    return this.#spendable;
  }

  public get headroomWaived() {
    return this.#headroomWaived;
  }

  public reserveSufficientAmount(desiredAmount: number) {
    const value = Math.min(desiredAmount, this.#spendable);

    if (value <= 0) {
      throw new Error(`Insufficient balance: ${this.#spendable} < ${desiredAmount}`);
    }

    this.#spendable -= value;

    return value;
  }
}

@singleton()
export class CachedBalanceService {
  public get = memoizeAsync((address: string) => this.buildForAddress(address), { cacheItemLimit: 10_000 });

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly balancesService: BalancesService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CachedBalanceService.name });
  }

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
    const headroom = denomToUdenom(this.deploymentConfig.get("AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD"));
    const balance = new CachedBalance(limits.deployment, headroom);

    this.logger.info({
      event: "AUTO_TOP_UP_BALANCE_HEADROOM",
      address,
      available: balance.available,
      headroom,
      spendable: balance.spendable,
      waived: balance.headroomWaived
    });

    return balance;
  }
}

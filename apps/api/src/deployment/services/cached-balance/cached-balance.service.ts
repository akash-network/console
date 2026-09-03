import { inject, singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";
import { memoizeAsync } from "@src/caching/helpers";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { denomToUdenom } from "@src/utils/math";

export class CachedBalance {
  readonly #available: number;
  readonly #headroom: number;
  #headroomWaived: boolean;
  #reserved = 0;

  /** The floor is kept only while what sits above it is at least `minDeposit`, and is resolved once per funding pass. */
  constructor(available: number, { headroom, minDeposit }: { headroom: number; minDeposit: number }) {
    this.#available = available;
    this.#headroom = headroom;
    this.#headroomWaived = headroom > 0 && available - headroom < minDeposit;
  }

  public get available() {
    return this.#available;
  }

  public get spendable() {
    return (this.#headroomWaived ? this.#available : this.#available - this.#headroom) - this.#reserved;
  }

  public get headroomWaived() {
    return this.#headroomWaived;
  }

  /** Yields the floor for the rest of the pass, so no deposit is ever lost to it. */
  public waiveHeadroom(): void {
    this.#headroomWaived = true;
  }

  /**
   * What `reserveSufficientAmount` would hand out, without taking it, so a caller can decline a deposit
   * before the allowance is spoken for and leave it to the rest of the owner's batch.
   */
  public previewSufficientAmount(desiredAmount: number) {
    return Math.min(desiredAmount, this.spendable);
  }

  /** Lets a caller weigh a floor concession before making it. */
  public previewSufficientAmountWithoutHeadroom(desiredAmount: number) {
    return Math.min(desiredAmount, this.#available - this.#reserved);
  }

  public reserveSufficientAmount(desiredAmount: number) {
    const value = this.previewSufficientAmount(desiredAmount);

    if (value <= 0) {
      throw new Error(`Insufficient balance: ${this.spendable} < ${desiredAmount}`);
    }

    this.#reserved += value;

    return value;
  }
}

@singleton()
export class CachedBalanceService {
  public get = memoizeAsync((address: string) => this.buildForAddress(address), { cacheItemLimit: 10_000, name: "CachedBalanceService#get" });

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

  /** The floor's minimum is the platform's own default deposit, the smallest amount it will ever deposit. */
  private async buildForAddress(address: string): Promise<CachedBalance> {
    const limits = await this.balancesService.getFreshLimits({ address });
    const headroom = denomToUdenom(this.deploymentConfig.get("AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD"));
    const minDeposit = denomToUdenom(this.deploymentConfig.get("DEPLOYMENT_DEFAULT_DEPOSIT"));
    const balance = new CachedBalance(limits.deployment, { headroom, minDeposit });

    this.logger.info({
      event: "AUTO_TOP_UP_BALANCE_HEADROOM",
      address,
      available: balance.available,
      headroom,
      minDeposit,
      spendable: balance.spendable,
      waived: balance.headroomWaived
    });

    return balance;
  }
}

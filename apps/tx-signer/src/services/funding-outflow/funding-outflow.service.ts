import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { RecentRead } from "@src/lib/recent-read/recent-read";
import { TxOutcomeUnknownError } from "@src/lib/signing-client/tx-outcome.error";
import type { FundingOutflowLimit, FundingOutflowStatus } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { FundingOutflowRepository, type OutflowUsage } from "@src/repositories/funding-outflow/funding-outflow.repository";

export const OUTFLOW_WINDOW_HOURS = 24;
const NEARING_LIMIT_PERCENT = 80n;
/** A deposit goes uncounted on the strength of limits read this recently, so a database blip refuses nothing while no limit is enforced. */
const MAX_MS_TRUSTING_LAST_LIMITS_READ = 60_000;
const WHOLE_AMOUNT = /^\d+$/;

type SettledTx = { code: number; hash: string };
type LimitCheck = { limit: FundingOutflowLimit; usedAmount: bigint };

@singleton()
export class FundingOutflowService {
  readonly #recentLimits = new RecentRead<FundingOutflowLimit[]>(MAX_MS_TRUSTING_LAST_LIMITS_READ);

  constructor(
    @inject(FundingControlsDatabase) private readonly database: FundingControlsDatabase,
    @inject(FundingOutflowRepository) private readonly repository: FundingOutflowRepository,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {
    this.logger.setContext(FundingOutflowService.name);
  }

  /** Reads the limits before the signer listens, so the first deposit after a start already has limits to fall back on. */
  async load(): Promise<void> {
    if (!this.database.isConfigured) return;

    const limits = await this.#readLimits();
    this.logger.info({ event: "FUNDING_OUTFLOW_LIMITS_LOADED", limits: limits.length, enforced: limits.filter(limit => limit.isEnforced).length });
  }

  /** Counts the deposits before the transaction is signed and takes them back when it did not land, so a refused or failed deposit never weighs on a limit. */
  async track<T extends SettledTx>(walletAddress: string, deposits: readonly Coin[], signAndBroadcast: () => Promise<T>): Promise<T> {
    if (!this.database.isConfigured || deposits.length === 0) return await signAndBroadcast();

    const reservationIds = await this.#reserve(walletAddress, sumByDenom(deposits));
    let tx: T;

    try {
      tx = await signAndBroadcast();
    } catch (error) {
      if (!(error instanceof TxOutcomeUnknownError)) await this.#settle(reservationIds, "released");
      throw error;
    }

    await this.#settle(reservationIds, tx.code === 0 ? "landed" : "released", tx.hash);

    return tx;
  }

  async #reserve(walletAddress: string, amountsByDenom: ReadonlyMap<string, bigint>): Promise<string[]> {
    let reservationIds: string[] = [];
    let exceeded: LimitCheck[];

    try {
      const limits = await this.#readLimits();
      reservationIds = await this.repository.reserve(walletAddress, amountsByDenom);
      const usageByDenom = await this.repository.sumSince({ windowHours: OUTFLOW_WINDOW_HOURS, denoms: [...amountsByDenom.keys()], walletAddress });
      exceeded = this.#findExceededLimits(limits, usageByDenom, walletAddress);
    } catch (error) {
      this.#assertMayGoUncounted(error);
      return reservationIds;
    }

    if (exceeded.some(({ limit }) => limit.isEnforced)) {
      await this.#settle(reservationIds, "released");
      throw createError(429, `This deposit would take more out of the funding wallets than may leave them in ${OUTFLOW_WINDOW_HOURS} hours`);
    }

    return reservationIds;
  }

  async #readLimits(): Promise<FundingOutflowLimit[]> {
    return await this.#recentLimits.refresh(() => this.repository.findLimits());
  }

  #findExceededLimits(limits: readonly FundingOutflowLimit[], usageByDenom: ReadonlyMap<string, OutflowUsage>, walletAddress: string): LimitCheck[] {
    const checks = [...usageByDenom].flatMap(([denom, usage]) => checkLimits(limits, denom, usage, walletAddress));
    const exceeded = checks.filter(({ limit, usedAmount }) => usedAmount > limit.maxAmount);
    const nearing = checks.filter(({ limit, usedAmount }) => usedAmount <= limit.maxAmount && usedAmount * 100n >= limit.maxAmount * NEARING_LIMIT_PERCENT);

    for (const check of exceeded) this.logger.error({ event: "FUNDING_OUTFLOW_LIMIT_EXCEEDED", walletAddress, ...describeCheck(check) });
    for (const check of nearing) this.logger.warn({ event: "FUNDING_OUTFLOW_LIMIT_NEARING", walletAddress, ...describeCheck(check) });

    return exceeded;
  }

  #assertMayGoUncounted(error: unknown): void {
    const recentLimits = this.#recentLimits.recall();
    const isUncountedAllowed = recentLimits !== undefined && !recentLimits.value.some(limit => limit.isEnforced);
    this.logger.error({ event: "FUNDING_OUTFLOW_UNCOUNTED", isUncountedAllowed, error });

    if (!isUncountedAllowed) {
      throw createError(503, "What leaves the funding wallets could not be counted against its limits, so no deposit from a funding wallet is signed", {
        cause: error
      });
    }
  }

  /** Never throws, because by now the transaction has its outcome and a failed write must not change what the caller is told. */
  async #settle(reservationIds: readonly string[], status: FundingOutflowStatus, txHash?: string): Promise<void> {
    if (reservationIds.length === 0) return;

    try {
      await this.repository.settle(reservationIds, status, txHash);
    } catch (error) {
      this.logger.error({ event: "FUNDING_OUTFLOW_UNSETTLED", reservationIds, status, txHash, error });
    }
  }
}

function sumByDenom(deposits: readonly Coin[]): Map<string, bigint> {
  const amountsByDenom = new Map<string, bigint>();

  for (const { denom, amount } of deposits) {
    if (!WHOLE_AMOUNT.test(amount)) throw createError(400, `A deposit of "${amount}" ${denom} is not a whole amount`);

    amountsByDenom.set(denom, (amountsByDenom.get(denom) ?? 0n) + BigInt(amount));
  }

  return amountsByDenom;
}

function checkLimits(limits: readonly FundingOutflowLimit[], denom: string, usage: OutflowUsage, walletAddress: string): LimitCheck[] {
  const ofDenom = limits.filter(limit => limit.denom === denom);
  const totalLimit = ofDenom.find(limit => limit.scope === "total");
  const walletLimit =
    ofDenom.find(limit => limit.walletAddress === walletAddress) ?? ofDenom.find(limit => limit.scope === "wallet" && limit.walletAddress === null);

  return [...(totalLimit ? [{ limit: totalLimit, usedAmount: usage.total }] : []), ...(walletLimit ? [{ limit: walletLimit, usedAmount: usage.wallet }] : [])];
}

function describeCheck({ limit, usedAmount }: LimitCheck) {
  return {
    scope: limit.scope,
    denom: limit.denom,
    isLimitOfThisWalletAlone: limit.walletAddress !== null,
    usedAmount: usedAmount.toString(),
    maxAmount: limit.maxAmount.toString(),
    isEnforced: limit.isEnforced
  };
}

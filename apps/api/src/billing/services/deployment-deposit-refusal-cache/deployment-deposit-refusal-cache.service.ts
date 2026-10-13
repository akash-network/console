import { LRUCache } from "lru-cache";
import { singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { cacheRegistry, nominalEntrySizing } from "@src/caching/cache-registry";
import { BillingConfigService } from "../billing-config/billing-config.service";

const MAX_TRACKED_WALLETS = 10_000;
/** A few numbers under a wallet id, so the registry ranks this cache far below the ones holding response payloads. */
const ENTRY_BYTES = 128;

type RefusedWallet = Pick<UserWalletOutput, "id" | "deploymentAllowance">;

export interface CachedDepositRefusal {
  chainDeploymentAllowance: number;
  suppressedAttempts: number;
  retryAfterSeconds: number;
}

interface DepositRefusalEntry {
  chainDeploymentAllowance: number;
  /** Every funding path writes the fresh grant to the wallet row, so a row that still shows this value has not been funded since the refusal. */
  walletDeploymentAllowanceSnapshot: number;
  suppressedAttempts: number;
}

@singleton()
export class DeploymentDepositRefusalCache {
  readonly #entries: LRUCache<number, DepositRefusalEntry>;

  constructor(billingConfigService: BillingConfigService) {
    this.#entries = new LRUCache({
      max: MAX_TRACKED_WALLETS,
      ttl: billingConfigService.get("DEPLOYMENT_CREATE_REFUSAL_CACHE_TTL_SECONDS") * 1000,
      ...nominalEntrySizing(MAX_TRACKED_WALLETS, ENTRY_BYTES)
    });
    cacheRegistry.register(DeploymentDepositRefusalCache.name, this.#entries);
  }

  find(userWallet: RefusedWallet, requiredDeposit: number): CachedDepositRefusal | undefined {
    const entry = this.#entries.get(userWallet.id);

    if (!entry) {
      return undefined;
    }

    if (entry.walletDeploymentAllowanceSnapshot !== userWallet.deploymentAllowance) {
      this.#entries.delete(userWallet.id);
      return undefined;
    }

    if (!isInsufficient(entry.chainDeploymentAllowance, requiredDeposit)) {
      return undefined;
    }

    entry.suppressedAttempts += 1;

    return {
      chainDeploymentAllowance: entry.chainDeploymentAllowance,
      suppressedAttempts: entry.suppressedAttempts,
      retryAfterSeconds: this.#getRetryAfterSeconds(userWallet.id)
    };
  }

  remember(userWallet: RefusedWallet, chainDeploymentAllowance: number): { retryAfterSeconds: number } {
    this.#entries.set(userWallet.id, {
      chainDeploymentAllowance,
      walletDeploymentAllowanceSnapshot: userWallet.deploymentAllowance,
      suppressedAttempts: 0
    });

    return { retryAfterSeconds: this.#getRetryAfterSeconds(userWallet.id) };
  }

  #getRetryAfterSeconds(walletId: number): number {
    return Math.max(1, Math.ceil(this.#entries.getRemainingTTL(walletId) / 1000));
  }
}

export function isInsufficient(deploymentAllowance: number, requiredDeposit: number): boolean {
  return deploymentAllowance <= 0 || deploymentAllowance < requiredDeposit;
}

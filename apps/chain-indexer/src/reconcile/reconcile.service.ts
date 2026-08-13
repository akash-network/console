import { eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { AccountBalances, Accounts, IndexerState } from "@src/db/schema";
import type { CoinAmount } from "@src/pipeline/balance/coin-amount";
import { SYNC_STREAM } from "@src/pipeline/block-committer.service";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";
import {
  ALL_BALANCES_PATH,
  decodeAllBalances,
  decodeTotalSupply,
  encodeAllBalancesRequest,
  encodeTotalSupplyRequest,
  TOTAL_SUPPLY_PATH
} from "@src/reconcile/bank-query";
import type { CoinDiff } from "@src/reconcile/coin-diff";
import { diffCoins } from "@src/reconcile/coin-diff";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

const DEFAULT_SAMPLE_SIZE = 100;

/** Bounds concurrent ABCI round-trips so the sampled accounts load-balance across the RPC pool without flooding any single node. */
const RECONCILE_CONCURRENCY = 10;

interface AccountBalance {
  address: string;
  coins: CoinAmount[];
}

/**
 * Proves the ledger matches the chain. At the indexer's `sync` checkpoint height it compares each sampled
 * account's current balance against the node's bank balance, and the ledger's total per denom against the
 * chain's supply. Querying at the checkpoint (not the moving tip) keeps the comparison race-free.
 */
@singleton()
export class ReconcileService {
  readonly #db: ChainDatabase;
  readonly #rpc: RpcClientPool;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(RpcClientPool) rpc: RpcClientPool, @inject(LoggerService) logger: LoggerService) {
    this.#db = db;
    this.#rpc = rpc;
    this.#logger = logger;
    this.#logger.setContext("RECONCILE");
  }

  async reconcile({ sampleSize = DEFAULT_SAMPLE_SIZE }: { sampleSize?: number } = {}): Promise<boolean> {
    if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
      this.#logger.error({ event: "RECONCILE_INVALID_SAMPLE_SIZE", sampleSize });
      return false;
    }

    const snapshot = await this.#readSnapshot();
    if (snapshot === undefined) {
      this.#logger.warn({ event: "RECONCILE_NO_CHECKPOINT" });
      return false;
    }

    const { height, balances } = snapshot;
    const sampled = this.#sample(balances, sampleSize);
    this.#logger.info({ event: "RECONCILE_START", height, accounts: balances.length, sampled: sampled.length });

    const accountMatches = await mapWithConcurrency(sampled, RECONCILE_CONCURRENCY, async account => {
      const chain = decodeAllBalances((await this.#rpc.abciQuery(ALL_BALANCES_PATH, encodeAllBalancesRequest(account.address), height)).value);
      const diffs = diffCoins(chain, account.coins);
      if (diffs.length === 0) return true;
      this.#logger.error({ event: "RECONCILE_ACCOUNT_MISMATCH", address: account.address, diffs: format(diffs) });
      return false;
    });

    let mismatches = accountMatches.filter(matched => !matched).length;

    const chainSupply = decodeTotalSupply((await this.#rpc.abciQuery(TOTAL_SUPPLY_PATH, encodeTotalSupplyRequest(), height)).value);
    const supplyDiffs = diffCoins(chainSupply, totals(balances));
    if (supplyDiffs.length > 0) {
      mismatches++;
      this.#logger.error({ event: "RECONCILE_SUPPLY_MISMATCH", diffs: format(supplyDiffs) });
    }

    const ok = mismatches === 0;
    this.#logger[ok ? "info" : "error"]({ event: ok ? "RECONCILE_OK" : "RECONCILE_FAILED", height, mismatches });
    return ok;
  }

  /**
   * Reads the checkpoint height and the ledger balances from one REPEATABLE READ snapshot. The committer advances
   * both in a single transaction, so reading them as two independent SELECTs could straddle a commit — stale height
   * against post-commit balances — and flag spurious mismatches on any account touched by that block.
   */
  async #readSnapshot(): Promise<{ height: number; balances: AccountBalance[] } | undefined> {
    return this.#db.transaction(
      async tx => {
        const height = await this.#readCheckpointHeight(tx);
        if (height === undefined) return undefined;
        return { height, balances: await this.#readLedgerBalances(tx) };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" }
    );
  }

  async #readCheckpointHeight(tx: ChainTransaction): Promise<number | undefined> {
    const [row] = await tx.select().from(IndexerState).where(eq(IndexerState.stream, SYNC_STREAM));
    return row?.lastHeight;
  }

  async #readLedgerBalances(tx: ChainTransaction): Promise<AccountBalance[]> {
    const rows = await tx
      .select({ address: Accounts.address, denom: AccountBalances.denom, amount: AccountBalances.amount })
      .from(AccountBalances)
      .innerJoin(Accounts, eq(AccountBalances.accountId, Accounts.id));

    const byAddress = new Map<string, CoinAmount[]>();
    for (const row of rows) {
      const coins = byAddress.get(row.address) ?? [];
      coins.push({ denom: row.denom, amount: BigInt(row.amount) });
      byAddress.set(row.address, coins);
    }

    return [...byAddress.entries()].map(([address, coins]) => ({ address, coins }));
  }

  /** Samples the highest-balance accounts, which carry the most reconciliation signal, capping RPC round-trips at `sampleSize`. */
  #sample(balances: AccountBalance[], sampleSize: number): AccountBalance[] {
    return balances
      .map(account => ({ account, total: sumCoins(account.coins) }))
      .sort((a, b) => (b.total < a.total ? -1 : 1))
      .slice(0, sampleSize)
      .map(entry => entry.account);
  }
}

/** Runs `worker` over `items` with at most `limit` in flight at once, preserving input order in the returned results. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function runWorker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

function totals(balances: AccountBalance[]): CoinAmount[] {
  const byDenom = new Map<string, bigint>();
  for (const account of balances) {
    for (const coin of account.coins) {
      byDenom.set(coin.denom, (byDenom.get(coin.denom) ?? 0n) + coin.amount);
    }
  }
  return [...byDenom.entries()].map(([denom, amount]) => ({ denom, amount }));
}

function sumCoins(coins: CoinAmount[]): bigint {
  return coins.reduce((sum, coin) => sum + coin.amount, 0n);
}

function format(diffs: CoinDiff[]): { denom: string; expected: string; actual: string }[] {
  return diffs.map(diff => ({ denom: diff.denom, expected: diff.expected.toString(), actual: diff.actual.toString() }));
}

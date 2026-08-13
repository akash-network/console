import { singleton } from "tsyringe";

import { insertChunked } from "@src/db/insert-chunked";
import { AccountBalances, BalanceChanges } from "@src/db/schema";
import type { ParsedGenesis } from "@src/genesis/genesis-schema";
import type { GenesisModuleSeeder, GenesisSeedContext } from "@src/genesis/genesis-seed-context";
import type { ChainTransaction } from "@src/providers/db.provider";

@singleton()
export class BankSeeder implements GenesisModuleSeeder {
  /**
   * Seeds every genesis balance as both a current-balance row and a `genesis`-reason ledger entry.
   * Seeding all `bank.balances` (module and vesting accounts included) makes the current-balance total
   * reconcile to `bank.supply` by construction. Idempotency comes from the import marker, so the ledger
   * insert intentionally has no conflict target.
   *
   * The ledger rows sit at `initialHeight - 1` (the pre-block opening balance) so they never collide with
   * block `initialHeight`'s own coin events on the `(height, event_index)` unique key and give that block's
   * batch a correct running-balance baseline.
   */
  async seed(tx: ChainTransaction, genesis: ParsedGenesis, context: GenesisSeedContext): Promise<void> {
    const balanceRows: (typeof AccountBalances.$inferInsert)[] = [];
    const changeRows: (typeof BalanceChanges.$inferInsert)[] = [];
    let eventIndex = 0;

    for (const balance of genesis.balances) {
      const accountId = context.accountIdByAddress.get(balance.address);
      if (accountId === undefined) {
        throw new Error(`No interned account id for balance address ${balance.address}`);
      }

      for (const coin of balance.coins) {
        balanceRows.push({ accountId, denom: coin.denom, amount: coin.amount });
        changeRows.push({
          accountId,
          denom: coin.denom,
          delta: coin.amount,
          balanceAfter: coin.amount,
          reason: "genesis",
          height: context.initialHeight - 1,
          txIndex: null,
          eventIndex: eventIndex++,
          counterpartyAccountId: null
        });
      }
    }

    await insertChunked(tx, AccountBalances, balanceRows);
    await insertChunked(tx, BalanceChanges, changeRows, { onConflictDoNothing: false });
  }
}

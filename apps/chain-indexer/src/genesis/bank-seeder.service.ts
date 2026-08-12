import chunk from "lodash/chunk";
import { singleton } from "tsyringe";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
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
   */
  async seed(tx: ChainTransaction, genesis: ParsedGenesis, context: GenesisSeedContext): Promise<void> {
    const balanceRows: (typeof AccountBalances.$inferInsert)[] = [];
    const changeRows: (typeof BalanceChanges.$inferInsert)[] = [];

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
          height: context.initialHeight,
          counterpartyAccountId: null
        });
      }
    }

    for (const rows of chunk(balanceRows, INSERT_CHUNK_SIZE)) {
      await tx.insert(AccountBalances).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(changeRows, INSERT_CHUNK_SIZE)) {
      await tx.insert(BalanceChanges).values(rows);
    }
  }
}

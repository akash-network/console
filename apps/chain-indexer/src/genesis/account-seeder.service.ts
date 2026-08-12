import chunk from "lodash/chunk";
import { singleton } from "tsyringe";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { Accounts } from "@src/db/schema";
import type { ParsedGenesis } from "@src/genesis/genesis-schema";
import type { ChainTransaction } from "@src/providers/db.provider";

@singleton()
export class AccountSeeder {
  /**
   * Interns every address that appears in genesis — auth accounts, balance holders, and delegators —
   * and returns the address→id map the other seeders reference. Genesis runs before block 1 against an
   * empty accounts table, so `returning()` yields the full mapping without a follow-up select.
   */
  async intern(tx: ChainTransaction, genesis: ParsedGenesis): Promise<Map<string, number>> {
    const accountByAddress = new Map(genesis.accounts.map(account => [account.address, account]));

    const addresses = new Set<string>();
    genesis.accounts.forEach(account => addresses.add(account.address));
    genesis.balances.forEach(balance => addresses.add(balance.address));
    genesis.delegations.forEach(delegation => addresses.add(delegation.delegatorAddress));

    const rows: (typeof Accounts.$inferInsert)[] = [...addresses].map(address => {
      const account = accountByAddress.get(address);
      return {
        address,
        accountNumber: account?.accountNumber ?? null,
        accountType: account?.accountType ?? null,
        isModuleAccount: account?.isModuleAccount ?? false
      };
    });

    const idByAddress = new Map<string, number>();
    for (const rowChunk of chunk(rows, INSERT_CHUNK_SIZE)) {
      const inserted = await tx.insert(Accounts).values(rowChunk).onConflictDoNothing().returning({ id: Accounts.id, address: Accounts.address });
      inserted.forEach(row => idByAddress.set(row.address, row.id));
    }

    return idByAddress;
  }
}

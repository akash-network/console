import { describe, expect, it } from "vitest";

import { AccountBalances, BalanceChanges } from "@src/db/schema";
import { BankSeeder } from "@src/genesis/bank-seeder.service";

import { buildTxFake, rowsFor } from "@test/fakes/build-tx-fake";
import { buildParsedGenesis } from "@test/fakes/genesis-fixtures";

describe(BankSeeder.name, () => {
  it("writes a current balance and a genesis ledger entry for each coin", async () => {
    const { seeder, tx, inserts } = setup();

    await seeder.seed(tx, buildParsedGenesis(), context());

    expect(rowsFor(inserts, AccountBalances)).toEqual([
      { accountId: 1, denom: "uakt", amount: "10" },
      { accountId: 2, denom: "uakt", amount: "5" },
      { accountId: 3, denom: "uakt", amount: "20" }
    ]);
    expect(rowsFor(inserts, BalanceChanges)).toEqual([
      { accountId: 1, denom: "uakt", delta: "10", balanceAfter: "10", reason: "genesis", height: 0, txIndex: null, eventIndex: 0, counterpartyAccountId: null },
      { accountId: 2, denom: "uakt", delta: "5", balanceAfter: "5", reason: "genesis", height: 0, txIndex: null, eventIndex: 1, counterpartyAccountId: null },
      { accountId: 3, denom: "uakt", delta: "20", balanceAfter: "20", reason: "genesis", height: 0, txIndex: null, eventIndex: 2, counterpartyAccountId: null }
    ]);
  });

  it("seeds current balances that total the genesis supply", async () => {
    const { seeder, tx, inserts } = setup();
    const genesis = buildParsedGenesis();

    await seeder.seed(tx, genesis, context());

    const seededTotal = rowsFor(inserts, AccountBalances).reduce((sum, row) => sum + BigInt(row.amount as string), 0n);
    const supplyTotal = genesis.supply.reduce((sum, coin) => sum + BigInt(coin.amount), 0n);
    expect(seededTotal).toBe(supplyTotal);
  });

  it("throws when a balance address was not interned", async () => {
    const { seeder, tx } = setup();
    const genesis = { ...buildParsedGenesis(), balances: [{ address: "akash1missing", coins: [{ denom: "uakt", amount: "1" }] }] };

    await expect(seeder.seed(tx, genesis, context())).rejects.toThrow("No interned account id for balance address akash1missing");
  });

  function context() {
    return {
      accountIdByAddress: new Map([
        ["akash1base", 1],
        ["akash1module", 2],
        ["akash1vesting", 3]
      ]),
      initialHeight: 1
    };
  }

  function setup() {
    const { tx, inserts } = buildTxFake();
    return { seeder: new BankSeeder(), tx, inserts };
  }
});

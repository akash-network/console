import { describe, expect, it } from "vitest";

import { Accounts } from "@src/db/schema";
import { AccountSeeder } from "@src/genesis/account-seeder.service";

import { buildTxFake, rowsFor } from "@test/fakes/build-tx-fake";
import { buildParsedGenesis } from "@test/fakes/genesis-fixtures";

describe(AccountSeeder.name, () => {
  it("interns every genesis address once and returns the address→id map", async () => {
    const { seeder, tx, inserts } = setup();

    const idByAddress = await seeder.intern(tx, buildParsedGenesis());

    expect([...idByAddress.keys()].sort()).toEqual(["akash1base", "akash1module", "akash1vesting"]);
    expect(rowsFor(inserts, Accounts)).toHaveLength(3);
  });

  it("records account metadata including the module-account flag", async () => {
    const { seeder, tx, inserts } = setup();

    await seeder.intern(tx, buildParsedGenesis());

    expect(rowsFor(inserts, Accounts)).toEqual([
      { address: "akash1base", accountNumber: 1, accountType: "base", isModuleAccount: false },
      { address: "akash1module", accountNumber: 2, accountType: "module", isModuleAccount: true },
      { address: "akash1vesting", accountNumber: 3, accountType: "vesting", isModuleAccount: false }
    ]);
  });

  it("interns balance and delegator addresses that have no auth account entry", async () => {
    const { seeder, tx, inserts } = setup();
    const genesis = {
      ...buildParsedGenesis(),
      accounts: [],
      balances: [{ address: "akash1holder", coins: [{ denom: "uakt", amount: "1" }] }],
      delegations: [{ delegatorAddress: "akash1delegator", validatorOperatorAddress: "akashvaloper1x", shares: "1" }]
    };

    const idByAddress = await seeder.intern(tx, genesis);

    expect([...idByAddress.keys()].sort()).toEqual(["akash1delegator", "akash1holder"]);
    expect(rowsFor(inserts, Accounts)).toEqual([
      { address: "akash1holder", accountNumber: null, accountType: null, isModuleAccount: false },
      { address: "akash1delegator", accountNumber: null, accountType: null, isModuleAccount: false }
    ]);
  });

  function setup() {
    const { tx, inserts } = buildTxFake();
    return { seeder: new AccountSeeder(), tx, inserts };
  }
});

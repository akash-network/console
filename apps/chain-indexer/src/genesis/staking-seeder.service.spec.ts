import { describe, expect, it } from "vitest";

import { Delegations, Validators } from "@src/db/schema";
import { StakingSeeder } from "@src/genesis/staking-seeder.service";

import { buildTxFake, rowsFor } from "@test/fakes/build-tx-fake";
import { buildParsedGenesis } from "@test/fakes/genesis-fixtures";

describe(StakingSeeder.name, () => {
  it("seeds validators from genesis", async () => {
    const { seeder, tx, inserts } = setup();

    await seeder.seed(tx, buildParsedGenesis(), context());

    expect(rowsFor(inserts, Validators)).toEqual([
      expect.objectContaining({
        operatorAddress: "akashvaloper1dq9wvqemmpvanmwsdttajsn4hmtx5zk7cgw7cz",
        accountAddress: "akash1dq9wvqemmpvanmwsdttajsn4hmtx5zk7j2qcgg",
        hexAddress: "31410FDD5FF7717918AB0D32645E12B6863B2576",
        moniker: "validator-01",
        commissionRate: "0.100000000000000000",
        minSelfDelegation: "1"
      })
    ]);
  });

  it("resolves the delegator account id for each delegation", async () => {
    const { seeder, tx, inserts } = setup();

    await seeder.seed(tx, buildParsedGenesis(), context());

    expect(rowsFor(inserts, Delegations)).toEqual([
      { delegatorAccountId: 1, validatorOperatorAddress: "akashvaloper1dq9wvqemmpvanmwsdttajsn4hmtx5zk7cgw7cz", shares: "1000000.000000000000000000" }
    ]);
  });

  it("writes nothing when there are no validators or delegations", async () => {
    const { seeder, tx, inserts } = setup();
    const genesis = { ...buildParsedGenesis(), validators: [], delegations: [] };

    await seeder.seed(tx, genesis, context());

    expect(inserts).toEqual([]);
  });

  it("throws when a delegator was not interned", async () => {
    const { seeder, tx } = setup();
    const genesis = { ...buildParsedGenesis(), delegations: [{ delegatorAddress: "akash1missing", validatorOperatorAddress: "akashvaloper1x", shares: "1" }] };

    await expect(seeder.seed(tx, genesis, context())).rejects.toThrow("No interned account id for delegator akash1missing");
  });

  function context() {
    return { accountIdByAddress: new Map([["akash1base", 1]]), initialHeight: 1 };
  }

  function setup() {
    const { tx, inserts } = buildTxFake();
    return { seeder: new StakingSeeder(), tx, inserts };
  }
});

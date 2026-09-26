import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { Accounts } from "@src/db/schema";
import { AccountSeeder } from "@src/genesis/account-seeder.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

import { buildParsedGenesis } from "@test/fakes/genesis-fixtures";

describe(AccountSeeder.name, () => {
  it("returns the ids of accounts that already exist alongside the ones it inserts", async () => {
    const { seeder, db, existing } = await setup();

    const idByAddress = await db.transaction(tx => seeder.intern(tx, buildParsedGenesis()));

    expect(idByAddress.get("akash1base")).toBe(existing.id);
    expect([...idByAddress.keys()].sort()).toEqual(["akash1base", "akash1module", "akash1vesting"]);
    expect(new Set(idByAddress.values()).size).toBe(3);
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(Accounts);
    const [existing] = await db.insert(Accounts).values({ address: "akash1base" }).returning();
    return { seeder: new AccountSeeder(), db, existing };
  }
});

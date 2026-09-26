import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AccountBalances, Accounts, ActMigrationQueue, BalanceChanges, Deployments, IndexerState, Providers } from "@src/db/schema";
import { ModuleResetService } from "@src/pipeline/module-replay/module-reset.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

describe(ModuleResetService.name, () => {
  it("empties every table of the module and nothing else", async () => {
    const { service, db, accountId } = await setup();
    await db.insert(Providers).values({ ownerAccountId: accountId, hostUri: "https://p.example", attributes: [], lastProcessedHeight: 1, createdHeight: 1 });
    await db.insert(AccountBalances).values({ accountId, denom: "uakt", amount: "1" });

    await db.transaction(tx => service.reset(tx, "provider"));

    expect(await db.select().from(Providers)).toEqual([]);
    expect(await db.select().from(AccountBalances)).toHaveLength(1);
    expect(await db.select().from(Accounts)).toHaveLength(1);
  });

  it("clears the act migration markers and queue together with the akash tables", async () => {
    const { service, db, accountId } = await setup();
    const [deployment] = await db
      .insert(Deployments)
      .values({
        ownerAccountId: accountId,
        dseq: "1",
        denom: "uakt",
        deposit: "0",
        balance: "0",
        withdrawnAmount: "0",
        lastProcessedHeight: 1,
        createdHeight: 1,
        createdAt: new Date(),
        cpuUnits: 0,
        gpuUnits: 0,
        memoryBytes: 0,
        ephemeralStorageBytes: 0,
        persistentStorageBytes: 0
      })
      .returning();
    await db.insert(ActMigrationQueue).values({ position: 1, deploymentId: deployment.id });
    await db.insert(IndexerState).values([
      { stream: "act-migration:upgrade", lastHeight: 5, updatedAt: new Date() },
      { stream: "sync", lastHeight: 9, updatedAt: new Date() }
    ]);

    await db.transaction(tx => service.reset(tx, "akash"));

    expect(await db.select().from(Deployments)).toEqual([]);
    expect(await db.select().from(ActMigrationQueue)).toEqual([]);
    expect((await db.select().from(IndexerState)).map(row => row.stream)).toEqual(["sync"]);
  });

  it("drops the genesis marker with the balance tables so the seed can run again", async () => {
    const { service, db, accountId } = await setup();
    await db.insert(BalanceChanges).values({ accountId, denom: "uakt", delta: "1", balanceAfter: "1", reason: "genesis", height: 1, eventIndex: 0 });
    await db.insert(IndexerState).values({ stream: "genesis", lastHeight: 1, updatedAt: new Date() });

    await db.transaction(tx => service.reset(tx, "balance"));

    expect(await db.select().from(BalanceChanges)).toEqual([]);
    expect(await db.select().from(IndexerState)).toEqual([]);
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.execute(sql`TRUNCATE cosmos.accounts CASCADE`);
    await db.delete(IndexerState);
    const [account] = await db
      .insert(Accounts)
      .values({ address: `akash1reset${Date.now()}` })
      .returning();
    const service = container.resolve(ModuleResetService);
    return { service, db, accountId: account.id };
  }
});

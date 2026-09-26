import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { Accounts, DeploymentGroups, Deployments, Leases, Providers } from "@src/db/schema";
import { ActiveSetsCheck } from "@src/parity/checks/active-sets.check";
import { createLegacyDatabase } from "@src/parity/legacy-db";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

describe(ActiveSetsCheck.name, () => {
  it("passes when the active deployment, lease and provider counts agree at every height", async () => {
    const { check } = await setup({ legacyLeaseClosedHeight: 30 });

    const result = await check.run();

    expect(result).toEqual({ name: "active-sets", status: "pass", summary: "3 entity sets agree at heights 20, 40", mismatches: [] });
  });

  it("fails with the entity and height whose active count differs", async () => {
    const { check } = await setup({ legacyLeaseClosedHeight: null });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.mismatches).toEqual([{ subject: "leases@40", expected: 1, actual: 0 }]);
  });

  async function setup(input: { legacyLeaseClosedHeight: number | null }) {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(Leases);
    await db.delete(DeploymentGroups);
    await db.delete(Deployments);
    await db.delete(Providers);
    await db.delete(Accounts);

    const [owner, provider] = await db
      .insert(Accounts)
      .values([{ address: "akash1owner" }, { address: "akash1provider" }])
      .returning();
    const [deployment] = await db
      .insert(Deployments)
      .values({
        ownerAccountId: owner.id,
        dseq: "1",
        denom: "uakt",
        deposit: "0",
        balance: "0",
        withdrawnAmount: "0",
        lastProcessedHeight: 10,
        createdHeight: 10,
        createdAt: new Date(),
        cpuUnits: 0,
        gpuUnits: 0,
        memoryBytes: 0,
        ephemeralStorageBytes: 0,
        persistentStorageBytes: 0
      })
      .returning();
    const [group] = await db.insert(DeploymentGroups).values({ deploymentId: deployment.id, gseq: 1 }).returning();
    await db.insert(Leases).values({
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      gseq: 1,
      oseq: 1,
      providerAccountId: provider.id,
      price: "1",
      denom: "uakt",
      predictedClosedHeight: "0",
      createdHeight: 12,
      createdAt: new Date(),
      closedHeight: 30,
      cpuUnits: 0,
      gpuUnits: 0,
      memoryBytes: 0,
      ephemeralStorageBytes: 0,
      persistentStorageBytes: 0
    });
    await db.insert(Providers).values({ ownerAccountId: provider.id, hostUri: "https://p", attributes: [], lastProcessedHeight: 5, createdHeight: 5 });

    await db.execute(sql`DROP TABLE IF EXISTS public.lease`);
    await db.execute(sql`DROP TABLE IF EXISTS public.deployment`);
    await db.execute(sql`DROP TABLE IF EXISTS public.provider`);
    await db.execute(sql`CREATE TABLE public.deployment ("createdHeight" integer NOT NULL, "closedHeight" integer)`);
    await db.execute(sql`CREATE TABLE public.lease ("createdHeight" integer NOT NULL, "closedHeight" integer)`);
    await db.execute(sql`CREATE TABLE public.provider ("createdHeight" integer NOT NULL, "deletedHeight" integer)`);
    await db.execute(sql`INSERT INTO public.deployment VALUES (10, NULL)`);
    await db.execute(sql`INSERT INTO public.lease VALUES (12, ${input.legacyLeaseClosedHeight})`);
    await db.execute(sql`INSERT INTO public.provider VALUES (5, NULL)`);

    const legacy = createLegacyDatabase(process.env.POSTGRES_DB_URI!);
    const check = new ActiveSetsCheck(db, legacy, [20, 40]);
    return { check };
  }
});

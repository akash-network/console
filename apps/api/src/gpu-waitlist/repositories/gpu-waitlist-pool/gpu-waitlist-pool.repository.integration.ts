import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiTransaction, TxService } from "@src/core/services/tx/tx.service";
import { GpuWaitlistPoolRepository } from "./gpu-waitlist-pool.repository";

describe(GpuWaitlistPoolRepository.name, () => {
  describe("upsert", () => {
    it("creates the pool and then overwrites its supply without touching the wave", async () => {
      const { repository, poolKey } = setup();

      await repository.upsert({ poolKey, lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 });
      await repository.update(poolKey, { waveNumber: 2 });
      await repository.upsert({ poolKey, lastFreeUnits: 3, lastMaxNodeFreeUnits: 2 });

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ lastFreeUnits: 3, lastMaxNodeFreeUnits: 2, waveNumber: 2 }));
    });
  });

  describe("findByPoolKeys", () => {
    it("returns the known pools among the keys", async () => {
      const { repository, poolKey } = setup();
      const otherPoolKey = `${poolKey}-other`;
      await repository.upsert({ poolKey, lastFreeUnits: 4, lastMaxNodeFreeUnits: 2 });
      await repository.upsert({ poolKey: otherPoolKey, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1 });

      const pools = await repository.findByPoolKeys([poolKey, `${poolKey}-unknown`]);

      expect(pools).toEqual([expect.objectContaining({ poolKey, lastFreeUnits: 4, lastMaxNodeFreeUnits: 2 })]);
    });

    it("returns nothing for no key", async () => {
      const { repository } = setup();

      expect(await repository.findByPoolKeys([])).toEqual([]);
    });
  });

  describe("findByPoolKeyAndLock", () => {
    it("returns undefined for an unknown pool", async () => {
      const { repository, poolKey } = setup();

      expect(await repository.findByPoolKeyAndLock(poolKey)).toBeUndefined();
    });

    it("makes a second transaction wait for the first and read what it committed", async () => {
      const { repository, poolKey } = setup();
      const txService = container.resolve(TxService);
      await repository.upsert({ poolKey, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1 });
      const firstHoldsLock = Promise.withResolvers<void>();
      const secondStarted = Promise.withResolvers<void>();

      const first = txService.transaction(async () => {
        await repository.findByPoolKeyAndLock(poolKey);
        await repository.update(poolKey, { waveNumber: 7 });
        firstHoldsLock.resolve();
        await secondStarted.promise;
        await waitUntilABackendWaitsOnALock(txService.getPgTx()!);
      });
      await firstHoldsLock.promise;
      const second = txService.transaction(async () => (await repository.findByPoolKeyAndLock(poolKey))?.waveNumber);
      secondStarted.resolve();
      await first;

      expect(await second).toBe(7);
    });
  });

  function setup() {
    return { repository: container.resolve(GpuWaitlistPoolRepository), poolKey: `pool-${faker.string.alphanumeric(16).toLowerCase()}` };
  }

  async function waitUntilABackendWaitsOnALock(connection: ApiTransaction) {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      const rows = await connection.execute<{ waiting: number }>(
        sql`select count(*)::int as waiting from pg_stat_activity where wait_event_type = 'Lock' and datname = current_database()`
      );

      if (rows[0].waiting > 0) return;

      await new Promise(resolve => setTimeout(resolve, 20));
    }

    throw new Error("No backend waited on a lock within 5 seconds");
  }
});

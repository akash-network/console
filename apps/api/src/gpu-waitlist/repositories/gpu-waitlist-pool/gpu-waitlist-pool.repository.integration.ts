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

    it("overwrites the free count when it still holds the observed value", async () => {
      const { repository, poolKey } = setup();
      await repository.upsert({ poolKey, lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 });

      await repository.upsert({ poolKey, lastFreeUnits: 6, lastMaxNodeFreeUnits: 4 }, { lastFreeUnits: 8 });

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ lastFreeUnits: 6, lastMaxNodeFreeUnits: 4 }));
    });

    it("keeps a free count a confirmation gave back after the pool was observed, and still records the largest node", async () => {
      const { repository, poolKey } = setup();
      await repository.upsert({ poolKey, lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 });
      const observed = await repository.findByPoolKeyAndLock(poolKey);
      await repository.resetFreeUnits([poolKey]);

      await repository.upsert({ poolKey, lastFreeUnits: 8, lastMaxNodeFreeUnits: 6 }, observed);

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ lastFreeUnits: 0, lastMaxNodeFreeUnits: 6 }));
    });

    it("creates a pool it observed as missing", async () => {
      const { repository, poolKey } = setup();

      await repository.upsert({ poolKey, lastFreeUnits: 5, lastMaxNodeFreeUnits: 5 }, { lastFreeUnits: 0 });

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ lastFreeUnits: 5, lastMaxNodeFreeUnits: 5 }));
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

  describe("claimForCheck", () => {
    it("claims only the pools not checked since the cooldown and marks them checked", async () => {
      const { repository, poolKey } = setup();
      const [neverChecked, cooledDown, recentlyChecked] = [`${poolKey}-never`, `${poolKey}-cooled`, `${poolKey}-recent`];
      const checkedAt = new Date("2026-11-18T12:00:00Z");
      const cooledDownBefore = new Date("2026-11-18T11:45:00Z");
      await repository.upsert({ poolKey: neverChecked, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1 });
      await repository.upsert({ poolKey: cooledDown, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1, lastCheckAt: cooledDownBefore });
      await repository.upsert({ poolKey: recentlyChecked, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1, lastCheckAt: new Date("2026-11-18T11:45:01Z") });

      const claimed = await repository.claimForCheck({
        poolKeys: [neverChecked, cooledDown, recentlyChecked, `${poolKey}-unknown`],
        checkedAt,
        cooledDownBefore
      });

      expect(claimed.sort()).toEqual([cooledDown, neverChecked].sort());
      expect(await repository.findByPoolKeys([neverChecked, cooledDown, recentlyChecked])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ poolKey: neverChecked, lastCheckAt: checkedAt }),
          expect.objectContaining({ poolKey: cooledDown, lastCheckAt: checkedAt }),
          expect.objectContaining({ poolKey: recentlyChecked, lastCheckAt: new Date("2026-11-18T11:45:01Z") })
        ])
      );
    });

    it("claims a pool once when two confirmations race for it", async () => {
      const { repository, poolKey } = setup();
      const checkedAt = new Date("2026-11-18T12:00:00Z");
      await repository.upsert({ poolKey, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1 });

      const claims = await Promise.all([
        repository.claimForCheck({ poolKeys: [poolKey], checkedAt, cooledDownBefore: new Date("2026-11-18T11:45:00Z") }),
        repository.claimForCheck({ poolKeys: [poolKey], checkedAt, cooledDownBefore: new Date("2026-11-18T11:45:00Z") })
      ]);

      expect(claims.flat()).toEqual([poolKey]);
    });

    it("claims nothing for no key", async () => {
      const { repository } = setup();

      expect(await repository.claimForCheck({ poolKeys: [], checkedAt: new Date(), cooledDownBefore: new Date() })).toEqual([]);
    });
  });

  describe("closeWaveIfUnchanged", () => {
    it("closes the wave when no round started since the pool was read", async () => {
      const { repository, poolKey } = setup();
      await repository.upsert({ poolKey, lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 });
      await repository.update(poolKey, { waveStartedAt: new Date("2026-11-18T12:00:00.123Z"), lastRoundAt: new Date("2026-11-18T12:30:00.456Z") });
      const read = await repository.findByPoolKeyAndLock(poolKey);

      await repository.closeWaveIfUnchanged(poolKey, read!);

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(
        expect.objectContaining({ waveStartedAt: null, lastRoundAt: new Date("2026-11-18T12:30:00.456Z") })
      );
    });

    it("closes a wave that never had a round when none started since the pool was read", async () => {
      const { repository, poolKey } = setup();
      await repository.upsert({ poolKey, lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 });
      await repository.update(poolKey, { waveStartedAt: new Date("2026-11-18T12:00:00Z") });
      const read = await repository.findByPoolKeyAndLock(poolKey);

      await repository.closeWaveIfUnchanged(poolKey, read!);

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ waveStartedAt: null, lastRoundAt: null }));
    });

    it("keeps the wave open when a round started after the pool was read", async () => {
      const { repository, poolKey } = setup();
      const waveStartedAt = new Date("2026-11-18T12:00:00Z");
      await repository.upsert({ poolKey, lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 });
      await repository.update(poolKey, { waveStartedAt, lastRoundAt: waveStartedAt });
      const read = await repository.findByPoolKeyAndLock(poolKey);
      await repository.update(poolKey, { lastRoundAt: new Date("2026-11-18T12:31:00Z") });

      await repository.closeWaveIfUnchanged(poolKey, read!);

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ waveStartedAt }));
    });

    it("keeps a wave that opened after the pool was read", async () => {
      const { repository, poolKey } = setup();
      const waveStartedAt = new Date("2026-11-18T12:00:00Z");
      await repository.upsert({ poolKey, lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 });
      const read = await repository.findByPoolKeyAndLock(poolKey);
      await repository.update(poolKey, { waveStartedAt, lastRoundAt: waveStartedAt });

      await repository.closeWaveIfUnchanged(poolKey, read!);

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ waveStartedAt }));
    });

    it("leaves other pools alone", async () => {
      const { repository, poolKey } = setup();
      const otherPoolKey = `${poolKey}-other`;
      const waveStartedAt = new Date("2026-11-18T12:00:00Z");
      await repository.upsert({ poolKey: otherPoolKey, lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 });
      await repository.update(otherPoolKey, { waveStartedAt, lastRoundAt: waveStartedAt });

      await repository.closeWaveIfUnchanged(poolKey, { waveStartedAt, lastRoundAt: waveStartedAt });

      expect(await repository.findByPoolKeyAndLock(otherPoolKey)).toEqual(expect.objectContaining({ waveStartedAt }));
    });
  });

  describe("resetFreeUnits", () => {
    it("zeroes the free units of the given pools only", async () => {
      const { repository, poolKey } = setup();
      const otherPoolKey = `${poolKey}-other`;
      await repository.upsert({ poolKey, lastFreeUnits: 6, lastMaxNodeFreeUnits: 4 });
      await repository.upsert({ poolKey: otherPoolKey, lastFreeUnits: 3, lastMaxNodeFreeUnits: 3 });

      await repository.resetFreeUnits([poolKey]);

      expect(await repository.findByPoolKeys([poolKey, otherPoolKey])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ poolKey, lastFreeUnits: 0, lastMaxNodeFreeUnits: 4 }),
          expect.objectContaining({ poolKey: otherPoolKey, lastFreeUnits: 3 })
        ])
      );
    });

    it("does nothing for no key", async () => {
      const { repository } = setup();

      await expect(repository.resetFreeUnits([])).resolves.toBeUndefined();
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
        firstHoldsLock.resolve();
        await secondStarted.promise;
        await waitUntilAnotherBackendWaitsOnThisOne(txService.getPgTx()!);
        await repository.update(poolKey, { waveNumber: 7 });
      });
      await Promise.race([firstHoldsLock.promise, first]);
      const second = txService.transaction(async () => (await repository.findByPoolKeyAndLock(poolKey))?.waveNumber);
      secondStarted.resolve();
      const [firstOutcome, secondOutcome] = await Promise.allSettled([first, second]);

      expect(firstOutcome).toEqual({ status: "fulfilled", value: undefined });
      expect(secondOutcome).toEqual({ status: "fulfilled", value: 7 });
    });
  });

  function setup() {
    return { repository: container.resolve(GpuWaitlistPoolRepository), poolKey: `pool-${faker.string.alphanumeric(16).toLowerCase()}` };
  }

  async function waitUntilAnotherBackendWaitsOnThisOne(connection: ApiTransaction) {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      await connection.execute(sql`select pg_stat_clear_snapshot()`);
      const rows = await connection.execute<{ waiting: number }>(
        sql`select count(*)::int as waiting from pg_stat_activity where pg_backend_pid() = any(pg_blocking_pids(pid))`
      );

      if (rows[0].waiting > 0) return;

      await new Promise(resolve => setTimeout(resolve, 20));
    }

    throw new Error("No backend waited on this transaction's lock within 5 seconds");
  }
});

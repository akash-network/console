import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB } from "@src/core/providers";
import { GpuWaitlistEntryRepository } from "./gpu-waitlist-entry.repository";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const HOUR_MS = 60 * 60 * 1000;

describe(GpuWaitlistEntryRepository.name, () => {
  describe("findPlaceInLineAcrossOrganizations", () => {
    it("counts the waiting entries of the pool that joined earlier, plus one", async () => {
      const { repository, poolModel, user } = await setup();
      const first = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, joinedAt: hoursAgo(3) });
      const second = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt: hoursAgo(2) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt: hoursAgo(1) });

      expect(await repository.findPlaceInLineAcrossOrganizations(first)).toBe(1);
      expect(await repository.findPlaceInLineAcrossOrganizations(second)).toBe(2);
    });

    it("breaks a tie on the join time by id, the way the pool is ordered", async () => {
      const { repository, poolModel } = await setup();
      const joinedAt = hoursAgo(2);
      const entries = [
        await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt }),
        await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt })
      ].sort((a, b) => a.id.localeCompare(b.id));

      expect(await repository.findPlaceInLineAcrossOrganizations(entries[0])).toBe(1);
      expect(await repository.findPlaceInLineAcrossOrganizations(entries[1])).toBe(2);
    });

    it("orders entries that joined within the same millisecond by the column's microseconds", async () => {
      const { repository, poolModel } = await setup();
      const earlier = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel });
      const later = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel });
      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      await db.execute(sql`update gpu_waitlist_entries set joined_at = '2026-11-18T12:00:00.123100Z' where id = ${earlier.id}`);
      await db.execute(sql`update gpu_waitlist_entries set joined_at = '2026-11-18T12:00:00.123900Z' where id = ${later.id}`);

      const laterAsRead = await repository.findById(later.id);

      expect(await repository.findPlaceInLineAcrossOrganizations(laterAsRead!)).toBe(2);
    });

    it("skips entries that left, were fulfilled, or wait for another pool", async () => {
      const { repository, poolModel, user } = await setup();
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "left", joinedAt: hoursAgo(5) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "fulfilled", joinedAt: hoursAgo(4) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: faker.string.alphanumeric(12), joinedAt: hoursAgo(3) });
      const mine = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, joinedAt: hoursAgo(1) });

      expect(await repository.findPlaceInLineAcrossOrganizations(mine)).toBe(1);
    });
  });

  describe("findWaitingInPool", () => {
    it("returns the waiting entries of the pool oldest first", async () => {
      const { repository, poolModel, user } = await setup();
      const newer = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, joinedAt: hoursAgo(1) });
      const older = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt: hoursAgo(2) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "expired" });

      const entries = await repository.findWaitingInPoolAcrossOrganizations(newer.poolKey);

      expect(entries.map(entry => entry.id)).toEqual([older.id, newer.id]);
    });
  });

  describe("findByIdAcrossOrganizations", () => {
    it("returns the entry with the id, whatever its status", async () => {
      const { repository, poolModel, user } = await setup();
      const entry = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, status: "left" });

      expect(await repository.findByIdAcrossOrganizations(entry.id)).toEqual(entry);
    });

    it("returns undefined for an unknown id", async () => {
      const { repository } = await setup();

      expect(await repository.findByIdAcrossOrganizations(faker.string.uuid())).toBeUndefined();
    });
  });

  describe("findJoinTimesAcrossOrganizationsSince", () => {
    it("lists the user's joins after the cutoff, whatever their status, oldest first", async () => {
      const { repository, user } = await setup();
      const recent = hoursAgo(1);
      const earlier = hoursAgo(2);
      await seedGpuWaitlistEntry({ userId: user.id, joinedAt: recent });
      await seedGpuWaitlistEntry({ userId: user.id, status: "left", joinedAt: earlier });
      await seedGpuWaitlistEntry({ userId: user.id, joinedAt: hoursAgo(30) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, joinedAt: recent });

      expect(await repository.findJoinTimesAcrossOrganizationsSince(user.id, hoursAgo(24))).toEqual([earlier, recent]);
    });
  });

  describe("countWaitingAcrossOrganizations", () => {
    it("counts only the user's waiting entries across organizations", async () => {
      const { repository, user } = await setup();
      await seedGpuWaitlistEntry({ userId: user.id });
      await seedGpuWaitlistEntry({ userId: user.id });
      await seedGpuWaitlistEntry({ userId: user.id, status: "left" });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id });

      expect(await repository.countWaitingAcrossOrganizations(user.id)).toBe(2);
    });
  });

  describe("findWaitingPoolKeysAcrossOrganizations", () => {
    it("lists each pool with a waiting entry once", async () => {
      const { repository, poolModel, user } = await setup();
      const entry = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel });
      const gone = await seedGpuWaitlistEntry({ userId: user.id, model: faker.string.alphanumeric(12), status: "left" });

      const poolKeys = await repository.findWaitingPoolKeysAcrossOrganizations();

      expect(poolKeys.filter(poolKey => poolKey === entry.poolKey)).toHaveLength(1);
      expect(poolKeys).not.toContain(gone.poolKey);
    });
  });

  describe("countWaitingBySetupAcrossOrganizations", () => {
    it("groups waiting entries by setup across users, with the oldest join time", async () => {
      const { repository, poolModel, user } = await setup();
      await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, gpuCount: 8, memory: "80Gi", interface: "sxm", joinedAt: hoursAgo(1) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, gpuCount: 8, memory: "80Gi", interface: "sxm", joinedAt: hoursAgo(5) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, gpuCount: 1, joinedAt: hoursAgo(2) });

      const rows = (await repository.countWaitingBySetupAcrossOrganizations()).filter(row => row.model === poolModel);

      expect(rows).toEqual([
        { vendor: "nvidia", model: poolModel, memory: "80Gi", interface: "sxm", gpuCount: 8, waiting: 2, oldestJoinedAt: hoursAgo(5) },
        { vendor: "nvidia", model: poolModel, memory: null, interface: null, gpuCount: 1, waiting: 1, oldestJoinedAt: hoursAgo(2) }
      ]);
    });

    it("ignores entries that are no longer waiting", async () => {
      const { repository, poolModel, user } = await setup();
      await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, status: "left" });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "fulfilled" });

      const rows = await repository.countWaitingBySetupAcrossOrganizations();

      expect(rows.filter(row => row.model === poolModel)).toEqual([]);
    });
  });

  function hoursAgo(hours: number) {
    return new Date(Math.floor((Date.now() - hours * HOUR_MS) / 1000) * 1000);
  }

  async function setup() {
    const repository = container.resolve(GpuWaitlistEntryRepository);
    const user = await seedUser();

    return { repository, user, poolModel: faker.string.alphanumeric(12).toLowerCase() };
  }
});

import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { GpuWaitlistEntryRepository } from "./gpu-waitlist-entry.repository";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const HOUR_MS = 60 * 60 * 1000;

describe(GpuWaitlistEntryRepository.name, () => {
  describe("findPlaceInLine", () => {
    it("counts the waiting entries of the pool that joined earlier, plus one", async () => {
      const { repository, poolModel, user } = await setup();
      const first = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, joinedAt: hoursAgo(3) });
      const second = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt: hoursAgo(2) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt: hoursAgo(1) });

      expect(await repository.findPlaceInLine(first)).toBe(1);
      expect(await repository.findPlaceInLine(second)).toBe(2);
    });

    it("skips entries that left, were fulfilled, or wait for another pool", async () => {
      const { repository, poolModel, user } = await setup();
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "left", joinedAt: hoursAgo(5) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "fulfilled", joinedAt: hoursAgo(4) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: faker.string.alphanumeric(12), joinedAt: hoursAgo(3) });
      const mine = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, joinedAt: hoursAgo(1) });

      expect(await repository.findPlaceInLine(mine)).toBe(1);
    });
  });

  describe("findWaitingInPool", () => {
    it("returns the waiting entries of the pool oldest first", async () => {
      const { repository, poolModel, user } = await setup();
      const newer = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel, joinedAt: hoursAgo(1) });
      const older = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, joinedAt: hoursAgo(2) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel, status: "expired" });

      const entries = await repository.findWaitingInPool(newer.poolKey);

      expect(entries.map(entry => entry.id)).toEqual([older.id, newer.id]);
    });
  });

  describe("findJoinTimesSince", () => {
    it("lists the user's joins after the cutoff, whatever their status, oldest first", async () => {
      const { repository, user } = await setup();
      const recent = hoursAgo(1);
      const earlier = hoursAgo(2);
      await seedGpuWaitlistEntry({ userId: user.id, joinedAt: recent });
      await seedGpuWaitlistEntry({ userId: user.id, status: "left", joinedAt: earlier });
      await seedGpuWaitlistEntry({ userId: user.id, joinedAt: hoursAgo(30) });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, joinedAt: recent });

      expect(await repository.findJoinTimesSince(user.id, hoursAgo(24))).toEqual([earlier, recent]);
    });
  });

  describe("countWaitingFor", () => {
    it("counts only the user's waiting entries across organizations", async () => {
      const { repository, user } = await setup();
      await seedGpuWaitlistEntry({ userId: user.id });
      await seedGpuWaitlistEntry({ userId: user.id });
      await seedGpuWaitlistEntry({ userId: user.id, status: "left" });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id });

      expect(await repository.countWaitingFor(user.id)).toBe(2);
    });
  });

  describe("findWaitingPoolKeys", () => {
    it("lists each pool with a waiting entry once", async () => {
      const { repository, poolModel, user } = await setup();
      const entry = await seedGpuWaitlistEntry({ userId: user.id, model: poolModel });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model: poolModel });
      const gone = await seedGpuWaitlistEntry({ userId: user.id, model: faker.string.alphanumeric(12), status: "left" });

      const poolKeys = await repository.findWaitingPoolKeys();

      expect(poolKeys.filter(poolKey => poolKey === entry.poolKey)).toHaveLength(1);
      expect(poolKeys).not.toContain(gone.poolKey);
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

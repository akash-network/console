import { inArray } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { type GpuBidCheckInsert, GpuBidCheckRepository } from "./gpu-bid-check.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(GpuBidCheckRepository.name, () => {
  describe("insertMany", () => {
    it("stores every check", async () => {
      const { repository, aCheck, findChecks } = setup();
      const missed = aCheck({ screened: true, bid: false });
      const bid = aCheck({ screened: false, bid: true });

      await repository.insertMany([missed, bid]);

      expect(await findChecks([missed.provider, bid.provider])).toEqual(
        expect.arrayContaining([expect.objectContaining(missed), expect.objectContaining(bid)])
      );
    });

    it("stores nothing for no check", async () => {
      const { repository } = setup();

      await expect(repository.insertMany([])).resolves.toBeUndefined();
    });
  });

  describe("deleteCheckedBefore", () => {
    it("deletes the checks made before the cutoff and keeps the rest", async () => {
      const { repository, aCheck, findChecks } = setup();
      const old = aCheck({ checkedAt: new Date("2026-09-18T23:59:59Z") });
      const atCutoff = aCheck({ checkedAt: new Date("2026-09-19T00:00:00Z") });
      const recent = aCheck({ checkedAt: new Date("2026-10-19T00:00:00Z") });
      await repository.insertMany([old, atCutoff, recent]);

      await repository.deleteCheckedBefore(new Date("2026-09-19T00:00:00Z"));

      const remaining = await findChecks([old.provider, atCutoff.provider, recent.provider]);
      expect(remaining.map(({ provider }) => provider).sort()).toEqual([atCutoff.provider, recent.provider].sort());
    });
  });

  function setup() {
    const repository = container.resolve(GpuBidCheckRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("GpuBidChecks");

    function aCheck(overrides: Partial<GpuBidCheckInsert> = {}): GpuBidCheckInsert {
      return {
        provider: createAkashAddress(),
        vendor: "nvidia",
        model: "h100",
        source: "pricing-bot",
        dseq: "1234567",
        screened: true,
        bid: true,
        checkedAt: new Date("2026-10-19T12:00:00Z"),
        ...overrides
      };
    }

    async function findChecks(providers: string[]) {
      return db.select().from(table).where(inArray(table.provider, providers));
    }

    return { repository, aCheck, findChecks };
  }
});

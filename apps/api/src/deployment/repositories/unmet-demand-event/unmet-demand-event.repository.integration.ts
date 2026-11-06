import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { type UnmetDemandEventInsert, UnmetDemandEventRepository } from "./unmet-demand-event.repository";

describe(UnmetDemandEventRepository.name, () => {
  describe("insertMany", () => {
    it("stores every event", async () => {
      const { repository, anEvent, findEvents } = setup();
      const noFit = anEvent({ kind: "no_fit", regionArea: "eu" });
      const zeroBid = anEvent({ kind: "zero_bid", vendor: null, model: null });

      await repository.insertMany([noFit, zeroBid]);

      expect(await findEvents(noFit.dedupeKey)).toEqual([{ ...noFit, id: expect.any(String) }]);
      expect(await findEvents(zeroBid.dedupeKey)).toEqual([{ ...zeroBid, id: expect.any(String) }]);
    });

    it("keeps the first event of a dedupe key and skips the rest, within a batch and across batches", async () => {
      const { repository, anEvent, findEvents } = setup();
      const first = anEvent({ gpuCount: 1 });

      await repository.insertMany([first, { ...first, gpuCount: 2 }]);
      await repository.insertMany([{ ...first, gpuCount: 3 }]);

      expect(await findEvents(first.dedupeKey)).toEqual([expect.objectContaining({ gpuCount: 1 })]);
    });

    it("stores nothing for no event", async () => {
      const { repository } = setup();

      await expect(repository.insertMany([])).resolves.toBeUndefined();
    });
  });

  describe("summarizeSince", () => {
    it("counts each kind and adds up the gpus asked per model and area since the cutoff", async () => {
      const { repository, anEvent } = setup();
      const model = `h100-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
      const since = new Date("2026-11-01T00:00:00Z");
      await repository.insertMany([
        anEvent({ model, kind: "no_fit", gpuCount: 8, occurredAt: since }),
        anEvent({ model, kind: "no_fit", gpuCount: 4 }),
        anEvent({ model, kind: "missing_gpu", gpuCount: 1 }),
        anEvent({ model, kind: "zero_bid", gpuCount: 2 }),
        anEvent({ model, kind: "zero_bid", gpuCount: 2, regionArea: "eu" }),
        anEvent({ model, kind: "no_fit", gpuCount: 64, occurredAt: new Date("2026-10-31T23:59:59Z") })
      ]);

      const summaries = await repository.summarizeSince(since);

      expect(summaries.filter(summary => summary.model === model)).toEqual(
        expect.arrayContaining([
          { vendor: "nvidia", model, regionArea: null, noFit: 2, missingGpu: 1, zeroBid: 1, gpusAsked: 15 },
          { vendor: "nvidia", model, regionArea: "eu", noFit: 0, missingGpu: 0, zeroBid: 1, gpusAsked: 2 }
        ])
      );
      expect(summaries.filter(summary => summary.model === model)).toHaveLength(2);
    });
  });

  function setup() {
    const repository = container.resolve(UnmetDemandEventRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("UnmetDemandEvents");

    function anEvent(overrides: Partial<UnmetDemandEventInsert>) {
      return {
        kind: "missing_gpu" as const,
        vendor: "nvidia",
        model: `h100-${faker.string.alphanumeric(8)}`,
        gpuCount: 8,
        regionArea: null,
        dedupeKey: faker.string.hexadecimal({ length: 64, prefix: "" }).toLowerCase(),
        occurredAt: new Date("2026-11-06T10:00:00Z"),
        ...overrides
      };
    }

    function findEvents(dedupeKey: string) {
      return db.select().from(table).where(eq(table.dedupeKey, dedupeKey));
    }

    return { repository, anEvent, findEvents };
  }
});

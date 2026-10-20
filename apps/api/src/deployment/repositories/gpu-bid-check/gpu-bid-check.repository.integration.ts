import { faker } from "@faker-js/faker";
import { inArray } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { type GpuBidCheckInsert, GpuBidCheckRepository } from "./gpu-bid-check.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const CUTOFF = new Date("2026-10-17T12:00:00Z");

const LAST_BID_CUTOFF = new Date("2026-09-19T12:00:00Z");

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

  describe("findPricingBotHistory", () => {
    it("counts the model's checks since the cutoff, the ones listing the provider, whether it bid since and its last bid since the last bid cutoff", async () => {
      const { repository, aCheck } = setup();
      const model = aModel();
      const provider = createAkashAddress();
      await repository.insertMany([
        aCheck({ provider, model, dseq: "1", bid: true, checkedAt: new Date("2026-10-10T00:00:00Z") }),
        aCheck({ provider, model, dseq: "2", bid: false, checkedAt: new Date("2026-10-18T00:00:00Z") }),
        aCheck({ provider, model, dseq: "3", bid: false, checkedAt: new Date("2026-10-18T06:00:00Z") }),
        aCheck({ provider, model, dseq: "4", bid: false, checkedAt: new Date("2026-10-19T00:00:00Z") }),
        aCheck({ model, dseq: "5", checkedAt: new Date("2026-10-19T06:00:00Z") })
      ]);

      const history = await repository.findPricingBotHistory({
        providers: [provider],
        models: [{ vendor: "nvidia", model }],
        since: CUTOFF,
        lastBidSince: LAST_BID_CUTOFF
      });

      expect(history).toEqual([
        { provider, vendor: "nvidia", model, checks: 4, screenedChecks: 3, bidSinceCutoff: false, lastBidAt: new Date("2026-10-10T00:00:00Z") }
      ]);
    });

    it("tells a bid since the cutoff, even on a check screening did not list the provider for", async () => {
      const { repository, aCheck } = setup();
      const model = aModel();
      const provider = createAkashAddress();
      await repository.insertMany([aCheck({ provider, model, dseq: "1", screened: false, bid: true, checkedAt: new Date("2026-10-18T00:00:00Z") })]);

      const [history] = await repository.findPricingBotHistory({
        providers: [provider],
        models: [{ vendor: "nvidia", model }],
        since: CUTOFF,
        lastBidSince: LAST_BID_CUTOFF
      });

      expect(history).toEqual(expect.objectContaining({ checks: 0, screenedChecks: 0, bidSinceCutoff: true, lastBidAt: new Date("2026-10-18T00:00:00Z") }));
    });

    it("reads no last bid for a provider whose last bid came before the last bid cutoff", async () => {
      const { repository, aCheck } = setup();
      const model = aModel();
      const [lateProvider, onTimeProvider] = [createAkashAddress(), createAkashAddress()];
      await repository.insertMany([
        aCheck({ provider: lateProvider, model, bid: true, checkedAt: new Date("2026-09-19T11:59:59Z") }),
        aCheck({ provider: onTimeProvider, model, bid: true, checkedAt: LAST_BID_CUTOFF })
      ]);

      const history = await repository.findPricingBotHistory({
        providers: [lateProvider, onTimeProvider],
        models: [{ vendor: "nvidia", model }],
        since: CUTOFF,
        lastBidSince: LAST_BID_CUTOFF
      });

      expect(history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: lateProvider, lastBidAt: null }),
          expect.objectContaining({ provider: onTimeProvider, lastBidAt: LAST_BID_CUTOFF })
        ])
      );
    });

    it("counts a check listing the provider once, however many rows it holds for it", async () => {
      const { repository, aCheck } = setup();
      const model = aModel();
      const provider = createAkashAddress();
      const check = aCheck({ provider, model, dseq: "1", bid: false, checkedAt: new Date("2026-10-18T00:00:00Z") });
      await repository.insertMany([check, check]);

      const [history] = await repository.findPricingBotHistory({
        providers: [provider],
        models: [{ vendor: "nvidia", model }],
        since: CUTOFF,
        lastBidSince: LAST_BID_CUTOFF
      });

      expect(history).toEqual(expect.objectContaining({ checks: 1, screenedChecks: 1 }));
    });

    it("reads no last bid for a provider that never bid", async () => {
      const { repository, aCheck } = setup();
      const model = aModel();
      const provider = createAkashAddress();
      await repository.insertMany([aCheck({ provider, model, bid: false })]);

      const [history] = await repository.findPricingBotHistory({
        providers: [provider],
        models: [{ vendor: "nvidia", model }],
        since: CUTOFF,
        lastBidSince: LAST_BID_CUTOFF
      });

      expect(history).toEqual(expect.objectContaining({ checks: 1, screenedChecks: 1, bidSinceCutoff: false, lastBidAt: null }));
    });

    it("reads each requested model of each requested provider apart, and nothing else", async () => {
      const { repository, aCheck } = setup();
      const [model, otherModel, unrequestedModel] = [aModel(), aModel(), aModel()];
      const [provider, otherProvider, unrequestedProvider] = [createAkashAddress(), createAkashAddress(), createAkashAddress()];
      await repository.insertMany([
        aCheck({ provider, model }),
        aCheck({ provider, model: otherModel }),
        aCheck({ provider: otherProvider, model }),
        aCheck({ provider, vendor: "amd", model }),
        aCheck({ provider, model: unrequestedModel }),
        aCheck({ provider: unrequestedProvider, model })
      ]);

      const history = await repository.findPricingBotHistory({
        providers: [provider, otherProvider],
        models: [
          { vendor: "nvidia", model },
          { vendor: "nvidia", model: otherModel }
        ],
        since: CUTOFF,
        lastBidSince: LAST_BID_CUTOFF
      });

      expect(history.map(({ provider, vendor, model }) => ({ provider, vendor, model }))).toEqual(
        expect.arrayContaining([
          { provider, vendor: "nvidia", model },
          { provider, vendor: "nvidia", model: otherModel },
          { provider: otherProvider, vendor: "nvidia", model }
        ])
      );
      expect(history).toHaveLength(3);
    });

    it("reads nothing for no provider or no model", async () => {
      const { repository } = setup();

      expect(
        await repository.findPricingBotHistory({ providers: [], models: [{ vendor: "nvidia", model: "h100" }], since: CUTOFF, lastBidSince: LAST_BID_CUTOFF })
      ).toEqual([]);
      expect(await repository.findPricingBotHistory({ providers: [createAkashAddress()], models: [], since: CUTOFF, lastBidSince: LAST_BID_CUTOFF })).toEqual(
        []
      );
    });
  });

  function aModel() {
    return `h100-${faker.string.alphanumeric(8)}`;
  }

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

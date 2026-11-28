import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { fundingFreezes } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { FundingFreezeRepository } from "./funding-freeze.repository";

import { createTestDatabase } from "@test/services/test-database.service";

describe(FundingFreezeRepository.name, () => {
  const testDatabase = createTestDatabase();

  describe("findActive", () => {
    it("finds no freeze in a database nobody froze", async () => {
      const { repository } = await setup();

      await expect(repository.findActive()).resolves.toBeUndefined();
    });

    it("finds the freeze that stands, with who set it and why", async () => {
      const { repository } = await setup();
      const created = await repository.create({ reason: "funding key suspected leaked", frozenBy: "on-call" });

      const active = await repository.findActive();

      expect(active).toEqual(created);
      expect(active).toMatchObject({ reason: "funding key suspected leaked", frozenBy: "on-call", liftedBy: null, liftedAt: null });
      expect(active!.frozenAt).toBeInstanceOf(Date);
    });

    it("finds the earliest of two freezes that stand", async () => {
      const { repository, database } = await setup();
      await database.orm.insert(fundingFreezes).values([
        { reason: "second", frozenBy: "b", frozenAt: new Date("2026-11-28T10:00:00.000Z") },
        { reason: "first", frozenBy: "a", frozenAt: new Date("2026-11-28T09:00:00.000Z") }
      ]);

      await expect(repository.findActive()).resolves.toMatchObject({ reason: "first", frozenBy: "a" });
    });

    it("finds no freeze once the one that stood is lifted", async () => {
      const { repository } = await setup();
      await repository.create({ reason: "drill", frozenBy: "on-call" });
      await repository.liftActive({ liftedBy: "on-call" });

      await expect(repository.findActive()).resolves.toBeUndefined();
    });
  });

  describe("liftActive", () => {
    it("lifts every freeze that stands and records who lifted it and when", async () => {
      const { repository } = await setup();
      await repository.create({ reason: "one", frozenBy: "a" });
      await repository.create({ reason: "two", frozenBy: "b" });

      const lifted = await repository.liftActive({ liftedBy: "on-call" });

      expect(lifted.map(freeze => freeze.reason).sort()).toEqual(["one", "two"]);
      expect(lifted.every(freeze => freeze.liftedBy === "on-call" && freeze.liftedAt instanceof Date)).toBe(true);
    });

    it("leaves a freeze lifted earlier as it was", async () => {
      const { repository, database } = await setup();
      await repository.create({ reason: "earlier", frozenBy: "a" });
      const [earlier] = await repository.liftActive({ liftedBy: "first operator" });
      await repository.create({ reason: "later", frozenBy: "b" });

      const lifted = await repository.liftActive({ liftedBy: "second operator" });

      expect(lifted.map(freeze => freeze.reason)).toEqual(["later"]);
      const rows = await database.orm.select().from(fundingFreezes);
      expect(rows.find(row => row.id === earlier.id)).toEqual(earlier);
    });

    it("lifts nothing when no freeze stands", async () => {
      const { repository } = await setup();

      await expect(repository.liftActive({ liftedBy: "on-call" })).resolves.toEqual([]);
    });
  });

  async function setup() {
    const config = mock<AppConfigService>();
    config.get.mockImplementation(((key: string) => {
      const values: Record<string, unknown> = { FUNDING_CONTROLS_POSTGRES_URL: testDatabase.url, FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS: 2 };

      return values[key];
    }) as AppConfigService["get"]);
    const database = new FundingControlsDatabase(config);
    onTestFinished(() => database.dispose());
    await database.orm.delete(fundingFreezes);

    return { repository: new FundingFreezeRepository(database), database };
  }
});

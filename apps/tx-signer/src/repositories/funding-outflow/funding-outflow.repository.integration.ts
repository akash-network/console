import { eq, inArray } from "drizzle-orm";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { fundingOutflowLimits, fundingOutflows, type FundingOutflowStatus } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { FundingOutflowRepository } from "./funding-outflow.repository";

import { createTestDatabase } from "@test/services/test-database.service";

const WALLET = "akash1depositor";
const OTHER_WALLET = "akash1other";

describe(FundingOutflowRepository.name, () => {
  const testDatabase = createTestDatabase();

  describe("reserve and settle", () => {
    it("records one reserved row per denom for the wallet", async () => {
      const { repository, database } = await setup();

      const ids = await repository.reserve(
        WALLET,
        new Map([
          ["uact", 16n],
          ["uakt", 7n]
        ])
      );

      const rows = await database.orm.select().from(fundingOutflows).where(inArray(fundingOutflows.id, ids));
      expect(rows.map(({ walletAddress, denom, amount, status, txHash, settledAt }) => ({ walletAddress, denom, amount, status, txHash, settledAt }))).toEqual(
        expect.arrayContaining([
          { walletAddress: WALLET, denom: "uact", amount: 16n, status: "reserved", txHash: null, settledAt: null },
          { walletAddress: WALLET, denom: "uakt", amount: 7n, status: "reserved", txHash: null, settledAt: null }
        ])
      );
      expect(rows).toHaveLength(2);
    });

    it("keeps an amount larger than a JavaScript number holds exactly", async () => {
      const { repository } = await setup();
      const amount = 9_007_199_254_740_993n;

      await repository.reserve(WALLET, new Map([["uact", amount]]));

      const usage = await repository.sumSince({ windowHours: 24, denoms: ["uact"], walletAddress: WALLET });
      expect(usage.get("uact")).toEqual({ total: amount, wallet: amount });
    });

    it("settles the rows it is given with their status, hash and time, leaving the others reserved", async () => {
      const { repository, database } = await setup();
      const settledIds = await repository.reserve(WALLET, new Map([["uact", 5n]]));
      const [untouchedId] = await repository.reserve(WALLET, new Map([["uact", 6n]]));

      await repository.settle(settledIds, "landed", "ABC123");

      const [settled] = await database.orm.select().from(fundingOutflows).where(eq(fundingOutflows.id, settledIds[0]));
      const [untouched] = await database.orm.select().from(fundingOutflows).where(eq(fundingOutflows.id, untouchedId));
      expect(settled).toMatchObject({ status: "landed", txHash: "ABC123", settledAt: expect.any(Date) });
      expect(untouched).toMatchObject({ status: "reserved", txHash: null, settledAt: null });
    });
  });

  describe("sumSince", () => {
    it("adds up what all wallets and what the given wallet took, per denom asked for", async () => {
      const { repository } = await setup();
      await repository.reserve(WALLET, new Map([["uact", 10n]]));
      await repository.reserve(WALLET, new Map([["uact", 5n]]));
      await repository.reserve(OTHER_WALLET, new Map([["uact", 100n]]));
      await repository.reserve(WALLET, new Map([["uakt", 7n]]));
      await repository.reserve(WALLET, new Map([["uusdc", 999n]]));

      const usage = await repository.sumSince({ windowHours: 24, denoms: ["uact", "uakt"], walletAddress: WALLET });

      expect(usage).toEqual(
        new Map([
          ["uact", { total: 115n, wallet: 15n }],
          ["uakt", { total: 7n, wallet: 7n }]
        ])
      );
    });

    it("answers zero for a wallet that took none of what others took", async () => {
      const { repository } = await setup();
      await repository.reserve(OTHER_WALLET, new Map([["uact", 100n]]));

      const usage = await repository.sumSince({ windowHours: 24, denoms: ["uact"], walletAddress: WALLET });

      expect(usage.get("uact")).toEqual({ total: 100n, wallet: 0n });
    });

    it("counts what is reserved and what landed, and leaves out what was released", async () => {
      const { repository } = await setup();
      await seedOutflow(repository, { amount: 1n, status: "landed" });
      await seedOutflow(repository, { amount: 2n, status: "released" });
      await repository.reserve(WALLET, new Map([["uact", 4n]]));

      const usage = await repository.sumSince({ windowHours: 24, denoms: ["uact"], walletAddress: WALLET });

      expect(usage.get("uact")).toEqual({ total: 5n, wallet: 5n });
    });

    it("leaves out what left before the window opened", async () => {
      const { repository, database } = await setup();
      const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
      await database.orm.insert(fundingOutflows).values([
        { walletAddress: WALLET, denom: "uact", amount: 1n, createdAt: hoursAgo(23) },
        { walletAddress: WALLET, denom: "uact", amount: 2n, createdAt: hoursAgo(25) }
      ]);

      const usage = await repository.sumSince({ windowHours: 24, denoms: ["uact"], walletAddress: WALLET });

      expect(usage.get("uact")).toEqual({ total: 1n, wallet: 1n });
    });

    it("answers nothing for a denom nobody took", async () => {
      const { repository } = await setup();

      await expect(repository.sumSince({ windowHours: 24, denoms: ["uact"], walletAddress: WALLET })).resolves.toEqual(new Map());
    });
  });

  describe("sumByDenomSince and sumByWalletSince", () => {
    it("adds up the window per denom and per wallet, largest wallets first, leaving out what was released", async () => {
      const { repository } = await setup();
      await repository.reserve(WALLET, new Map([["uact", 10n]]));
      await repository.reserve(WALLET, new Map([["uact", 5n]]));
      await repository.reserve(OTHER_WALLET, new Map([["uact", 100n]]));
      await repository.reserve(OTHER_WALLET, new Map([["uakt", 7n]]));
      await seedOutflow(repository, { amount: 1000n, status: "released" });

      await expect(repository.sumByDenomSince({ windowHours: 24 })).resolves.toEqual(
        new Map([
          ["uact", 115n],
          ["uakt", 7n]
        ])
      );
      await expect(repository.sumByWalletSince({ windowHours: 24, limit: 2 })).resolves.toEqual([
        { walletAddress: OTHER_WALLET, denom: "uact", amount: 100n },
        { walletAddress: WALLET, denom: "uact", amount: 15n }
      ]);
    });
  });

  describe("limits", () => {
    it("keeps one limit for all wallets together, one for each wallet and one per named wallet, side by side", async () => {
      const { repository } = await setup();
      await repository.setLimit({ denom: "uact", scope: "total", maxAmount: 5000n, isEnforced: true, setBy: "a" });
      await repository.setLimit({ denom: "uact", scope: "wallet", maxAmount: 100n, isEnforced: false, setBy: "b" });
      await repository.setLimit({ denom: "uact", scope: "wallet", walletAddress: WALLET, maxAmount: 900n, isEnforced: true, setBy: "c" });
      await repository.setLimit({ denom: "uakt", scope: "total", maxAmount: 70n, isEnforced: false, setBy: "d" });

      const limits = await repository.findLimits();

      expect(
        limits.map(({ denom, scope, walletAddress, maxAmount, isEnforced, setBy }) => ({ denom, scope, walletAddress, maxAmount, isEnforced, setBy }))
      ).toEqual(
        expect.arrayContaining([
          { denom: "uact", scope: "total", walletAddress: null, maxAmount: 5000n, isEnforced: true, setBy: "a" },
          { denom: "uact", scope: "wallet", walletAddress: null, maxAmount: 100n, isEnforced: false, setBy: "b" },
          { denom: "uact", scope: "wallet", walletAddress: WALLET, maxAmount: 900n, isEnforced: true, setBy: "c" },
          { denom: "uakt", scope: "total", walletAddress: null, maxAmount: 70n, isEnforced: false, setBy: "d" }
        ])
      );
      expect(limits).toHaveLength(4);
    });

    it("replaces a limit set again, leaving the others as they were", async () => {
      const { repository } = await setup();
      await repository.setLimit({ denom: "uact", scope: "wallet", maxAmount: 100n, isEnforced: false, setBy: "first" });
      await repository.setLimit({ denom: "uact", scope: "wallet", walletAddress: WALLET, maxAmount: 900n, isEnforced: false, setBy: "first" });

      const replaced = await repository.setLimit({ denom: "uact", scope: "wallet", maxAmount: 250n, isEnforced: true, setBy: "second" });

      expect(replaced).toMatchObject({ walletAddress: null, maxAmount: 250n, isEnforced: true, setBy: "second" });
      const limits = await repository.findLimits();
      expect(limits.map(limit => [limit.walletAddress, limit.maxAmount]).sort()).toEqual(
        [
          [null, 250n],
          [WALLET, 900n]
        ].sort()
      );
    });

    it("removes the limit it is pointed at and no other, and answers nothing when none matches", async () => {
      const { repository } = await setup();
      await repository.setLimit({ denom: "uact", scope: "wallet", maxAmount: 100n, isEnforced: false, setBy: "a" });
      await repository.setLimit({ denom: "uact", scope: "wallet", walletAddress: WALLET, maxAmount: 900n, isEnforced: false, setBy: "a" });

      const removed = await repository.removeLimit({ denom: "uact", scope: "wallet", walletAddress: WALLET });

      expect(removed).toMatchObject([{ walletAddress: WALLET, maxAmount: 900n }]);
      expect((await repository.findLimits()).map(limit => limit.walletAddress)).toEqual([null]);
      await expect(repository.removeLimit({ denom: "uact", scope: "total" })).resolves.toEqual([]);
    });

    it("refuses a limit of zero and a wallet named under the total scope", async () => {
      const { repository } = await setup();

      await expect(repository.setLimit({ denom: "uact", scope: "total", maxAmount: 0n, isEnforced: false, setBy: "a" })).rejects.toThrow();
      await expect(
        repository.setLimit({ denom: "uact", scope: "total", walletAddress: WALLET, maxAmount: 5n, isEnforced: false, setBy: "a" })
      ).rejects.toThrow();
      await expect(repository.findLimits()).resolves.toEqual([]);
    });
  });

  async function seedOutflow(repository: FundingOutflowRepository, input: { amount: bigint; status: FundingOutflowStatus }) {
    const ids = await repository.reserve(WALLET, new Map([["uact", input.amount]]));
    await repository.settle(ids, input.status, "SEEDED");
  }

  async function setup() {
    const config = mock<AppConfigService>();
    config.get.mockImplementation(((key: string) => {
      const values: Record<string, unknown> = { FUNDING_CONTROLS_POSTGRES_URL: testDatabase.url, FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS: 2 };

      return values[key];
    }) as AppConfigService["get"]);
    const database = new FundingControlsDatabase(config);
    onTestFinished(() => database.dispose());
    await database.orm.delete(fundingOutflows);
    await database.orm.delete(fundingOutflowLimits);

    return { repository: new FundingOutflowRepository(database), database };
  }
});

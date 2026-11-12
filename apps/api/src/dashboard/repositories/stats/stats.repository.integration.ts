import { addHours, subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { StatsRepository } from "./stats.repository";

import { createAkashBlock, createDay, createSinkTotalsSnapshot } from "@test/seeders";

describe(StatsRepository.name, () => {
  describe("findSinkDailyTotals", () => {
    it("returns for each day the last sink totals recorded up to its last block", async () => {
      const { repository } = await setup();
      const dayBeforeMigration = await createDay({
        date: new Date("2026-11-08T00:00:00Z"),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100
      });
      const firstMigrationDay = await createDay({
        date: new Date("2026-11-09T00:00:00Z"),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200
      });
      const quietDay = await createDay({ date: new Date("2026-11-10T00:00:00Z"), firstBlockHeight: 201, lastBlockHeight: 300, lastBlockHeightYet: 300 });
      const currentDay = await createDay({ date: new Date("2026-11-11T00:00:00Z"), firstBlockHeight: 301, lastBlockHeightYet: 350 });
      await currentDay.update({ lastBlockHeight: null });
      await createSnapshot({ height: 150, dayId: firstMigrationDay.id, mintedAmount: "100", mintedCount: 1 });
      await createSnapshot({
        height: 180,
        dayId: firstMigrationDay.id,
        pendingAmount: "10000000",
        pendingCount: 1,
        mintedAmount: "1612541902979",
        mintedCount: 27,
        voidedAmount: "3000000",
        voidedCount: 2,
        refundPendingAmount: "4000000",
        refundPendingCount: 3,
        refundedAmount: "5000000",
        refundedCount: 4
      });
      await createSnapshot({ height: 320, dayId: currentDay.id, mintedAmount: "2000000000000", mintedCount: 30 });

      const dailyTotals = await repository.findSinkDailyTotals();

      expect(dailyTotals).toEqual([
        {
          date: firstMigrationDay.date,
          pendingUakt: 10000000,
          pendingTransfers: 1,
          mintedUakt: 1612541902979,
          mintedTransfers: 27,
          voidedUakt: 3000000,
          voidedTransfers: 2,
          refundPendingUakt: 4000000,
          refundPendingTransfers: 3,
          refundedUakt: 5000000,
          refundedTransfers: 4
        },
        {
          date: quietDay.date,
          pendingUakt: 10000000,
          pendingTransfers: 1,
          mintedUakt: 1612541902979,
          mintedTransfers: 27,
          voidedUakt: 3000000,
          voidedTransfers: 2,
          refundPendingUakt: 4000000,
          refundPendingTransfers: 3,
          refundedUakt: 5000000,
          refundedTransfers: 4
        },
        { ...zeroTotals(), date: currentDay.date, mintedUakt: 2000000000000, mintedTransfers: 30 }
      ]);
      expect(dailyTotals.map(totals => totals.date)).not.toContainEqual(dayBeforeMigration.date);
    });

    it("leaves out the days whose blocks are not processed yet", async () => {
      const { repository } = await setup();
      const processedDay = await createDay({ date: new Date("2026-11-09T00:00:00Z"), firstBlockHeight: 101, lastBlockHeight: 200, lastBlockHeightYet: 200 });
      const unprocessedDay = await createDay({ date: new Date("2026-11-10T00:00:00Z"), firstBlockHeight: 201, lastBlockHeightYet: 250 });
      await unprocessedDay.update({ lastBlockHeight: null });
      await createSnapshot({ height: 150, dayId: processedDay.id, mintedAmount: "100", mintedCount: 1 });
      await createAkashBlock({ height: 201, dayId: unprocessedDay.id, isProcessed: false });

      const dailyTotals = await repository.findSinkDailyTotals();

      expect(dailyTotals).toEqual([{ ...zeroTotals(), date: processedDay.date, mintedUakt: 100, mintedTransfers: 1 }]);
    });
  });

  describe("findSinkDashboardData", () => {
    it("returns the sink totals as of the latest processed block, 24 hours earlier and 48 hours earlier", async () => {
      const { repository } = await setup();
      const latestProcessedBlockDate = new Date("2026-11-11T12:00:00Z");
      await createSnapshot({ height: 10, datetime: subHours(latestProcessedBlockDate, 50), mintedAmount: "100", mintedCount: 1 });
      await createSnapshot({
        height: 20,
        datetime: subHours(latestProcessedBlockDate, 30),
        mintedAmount: "300",
        mintedCount: 3,
        pendingAmount: "7",
        pendingCount: 1
      });
      await createSnapshot({
        height: 30,
        datetime: subHours(latestProcessedBlockDate, 10),
        mintedAmount: "600",
        mintedCount: 6,
        refundedAmount: "9",
        refundedCount: 2
      });
      await createAkashBlock({ height: 40, datetime: latestProcessedBlockDate, isProcessed: true });
      await createAkashBlock({ height: 50, datetime: addHours(latestProcessedBlockDate, 1), isProcessed: false });

      const dashboardData = await repository.findSinkDashboardData();

      expect(dashboardData).toEqual({
        now: { ...zeroTotals(), date: latestProcessedBlockDate, mintedUakt: 600, mintedTransfers: 6, refundedUakt: 9, refundedTransfers: 2 },
        compare: { ...zeroTotals(), date: subHours(latestProcessedBlockDate, 24), mintedUakt: 300, mintedTransfers: 3, pendingUakt: 7, pendingTransfers: 1 },
        secondCompare: { ...zeroTotals(), date: subHours(latestProcessedBlockDate, 48), mintedUakt: 100, mintedTransfers: 1 }
      });
    });

    it("returns zero totals for the periods that precede the first sink totals", async () => {
      const { repository } = await setup();
      const latestProcessedBlockDate = new Date("2026-11-11T12:00:00Z");
      await createAkashBlock({ height: 10, datetime: subHours(latestProcessedBlockDate, 50), isProcessed: true });
      await createSnapshot({ height: 40, datetime: latestProcessedBlockDate, mintedAmount: "600", mintedCount: 6 });

      const dashboardData = await repository.findSinkDashboardData();

      expect(dashboardData).toEqual({
        now: { ...zeroTotals(), date: latestProcessedBlockDate, mintedUakt: 600, mintedTransfers: 6 },
        compare: { ...zeroTotals(), date: subHours(latestProcessedBlockDate, 24) },
        secondCompare: { ...zeroTotals(), date: subHours(latestProcessedBlockDate, 48) }
      });
    });

    it("returns zero totals when no block is processed yet", async () => {
      const { repository } = await setup();

      const dashboardData = await repository.findSinkDashboardData();

      expect(dashboardData).toEqual({
        now: { ...zeroTotals(), date: expect.any(Date) },
        compare: { ...zeroTotals(), date: expect.any(Date) },
        secondCompare: { ...zeroTotals(), date: expect.any(Date) }
      });
    });
  });

  function zeroTotals() {
    return {
      pendingUakt: 0,
      pendingTransfers: 0,
      mintedUakt: 0,
      mintedTransfers: 0,
      voidedUakt: 0,
      voidedTransfers: 0,
      refundPendingUakt: 0,
      refundPendingTransfers: 0,
      refundedUakt: 0,
      refundedTransfers: 0
    };
  }

  async function createSnapshot(input: {
    height: number;
    datetime?: Date;
    dayId?: string;
    pendingAmount?: string;
    pendingCount?: number;
    mintedAmount?: string;
    mintedCount?: number;
    voidedAmount?: string;
    voidedCount?: number;
    refundPendingAmount?: string;
    refundPendingCount?: number;
    refundedAmount?: string;
    refundedCount?: number;
  }) {
    const { height, datetime, dayId, ...totals } = input;
    await createAkashBlock({ height, datetime, dayId, isProcessed: true });
    await createSinkTotalsSnapshot({ height, ...totals });
  }

  async function setup() {
    const chainDb = container.resolve(CHAIN_DB);
    await chainDb.authenticate();
    await chainDb.query('TRUNCATE "sink_totals_snapshot", "block", "day" CASCADE');

    return { repository: container.resolve(StatsRepository) };
  }
});

import { addHours, addSeconds, subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { StatsRepository } from "./stats.repository";

import { createAkashBlock, createDay, createSinkTotalsSnapshot, createSinkTransfer, createStakingUnbonding } from "@test/seeders";

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
      await createSinkTransfer({ height: 150, owner: "akash1returning" });
      await createSinkTransfer({ height: 180, sequence: 1, owner: "akash1returning" });
      await createSinkTransfer({ height: 180, sequence: 2, owner: "akash1second" });
      await createSinkTransfer({ height: 320, owner: "akash1third" });

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
          refundedTransfers: 4,
          uniqueSenders: 2
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
          refundedTransfers: 4,
          uniqueSenders: 2
        },
        { ...zeroTotals(), date: currentDay.date, mintedUakt: 2000000000000, mintedTransfers: 30, uniqueSenders: 3 }
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
        now: { ...zeroDashboardTotals(), date: latestProcessedBlockDate, mintedUakt: 600, mintedTransfers: 6, refundedUakt: 9, refundedTransfers: 2 },
        compare: {
          ...zeroDashboardTotals(),
          date: subHours(latestProcessedBlockDate, 24),
          mintedUakt: 300,
          mintedTransfers: 3,
          pendingUakt: 7,
          pendingTransfers: 1
        },
        secondCompare: { ...zeroDashboardTotals(), date: subHours(latestProcessedBlockDate, 48), mintedUakt: 100, mintedTransfers: 1 }
      });
    });

    it("returns the number of distinct senders and the median time to mint as of each period", async () => {
      const { repository } = await setup();
      const latestProcessedBlockDate = new Date("2026-11-11T12:00:00Z");
      const twoDaysAgo = subHours(latestProcessedBlockDate, 50);
      const yesterday = subHours(latestProcessedBlockDate, 30);
      const today = subHours(latestProcessedBlockDate, 10);
      await createAkashBlock({ height: 10, datetime: twoDaysAgo, isProcessed: true });
      await createAkashBlock({ height: 11, datetime: addSeconds(twoDaysAgo, 60), isProcessed: true });
      await createAkashBlock({ height: 20, datetime: yesterday, isProcessed: true });
      await createAkashBlock({ height: 21, datetime: addSeconds(yesterday, 120), isProcessed: true });
      await createAkashBlock({ height: 30, datetime: today, isProcessed: true });
      await createAkashBlock({ height: 31, datetime: addSeconds(today, 300), isProcessed: true });
      await createAkashBlock({ height: 40, datetime: latestProcessedBlockDate, isProcessed: true });
      await createSinkTransfer({ height: 10, owner: "akash1returning", status: "minted", statusHeight: 11 });
      await createSinkTransfer({ height: 20, sequence: 1, owner: "akash1second", status: "minted", statusHeight: 21 });
      await createSinkTransfer({ height: 20, sequence: 2, owner: "akash1voided", status: "voided", statusHeight: 21 });
      await createSinkTransfer({ height: 30, sequence: 1, owner: "akash1returning", status: "minted", statusHeight: 31 });
      await createSinkTransfer({ height: 30, sequence: 2, owner: "akash1pending", status: "pending" });

      const dashboardData = await repository.findSinkDashboardData();

      expect(dashboardData).toEqual({
        now: { ...zeroDashboardTotals(), date: latestProcessedBlockDate, uniqueSenders: 4, medianSecondsToMint: 120 },
        compare: { ...zeroDashboardTotals(), date: subHours(latestProcessedBlockDate, 24), uniqueSenders: 3, medianSecondsToMint: 90 },
        secondCompare: { ...zeroDashboardTotals(), date: subHours(latestProcessedBlockDate, 48), uniqueSenders: 1, medianSecondsToMint: 60 }
      });
    });

    it("returns zero totals for the periods that precede the first sink totals", async () => {
      const { repository } = await setup();
      const latestProcessedBlockDate = new Date("2026-11-11T12:00:00Z");
      await createAkashBlock({ height: 10, datetime: subHours(latestProcessedBlockDate, 50), isProcessed: true });
      await createSnapshot({ height: 40, datetime: latestProcessedBlockDate, mintedAmount: "600", mintedCount: 6 });

      const dashboardData = await repository.findSinkDashboardData();

      expect(dashboardData).toEqual({
        now: { ...zeroDashboardTotals(), date: latestProcessedBlockDate, mintedUakt: 600, mintedTransfers: 6 },
        compare: { ...zeroDashboardTotals(), date: subHours(latestProcessedBlockDate, 24) },
        secondCompare: { ...zeroDashboardTotals(), date: subHours(latestProcessedBlockDate, 48) }
      });
    });

    it("returns zero totals when no block is processed yet", async () => {
      const { repository } = await setup();

      const dashboardData = await repository.findSinkDashboardData();

      expect(dashboardData).toEqual({
        now: { ...zeroDashboardTotals(), date: expect.any(Date) },
        compare: { ...zeroDashboardTotals(), date: expect.any(Date) },
        secondCompare: { ...zeroDashboardTotals(), date: expect.any(Date) }
      });
    });
  });

  describe("findSinkTransfers", () => {
    it("returns the most recent transfers first with the dates of their creation and last status change", async () => {
      const { repository } = await setup();
      const { firstBlockDate, mintBlockDate, lastBlockDate } = await createTransfers();

      const transfers = await repository.findSinkTransfers({ skip: 0, limit: 10, sort: "latest" });

      expect(transfers).toEqual([
        {
          owner: "akash1latest",
          height: 30,
          sequence: 1,
          recipient: "solanaLatest",
          amountUakt: 5000000,
          status: "pending",
          createdAt: lastBlockDate,
          statusHeight: 30,
          statusUpdatedAt: lastBlockDate
        },
        {
          owner: "akash1largest",
          height: 10,
          sequence: 2,
          recipient: "solanaLargest",
          amountUakt: 975031000000,
          status: "minted",
          createdAt: firstBlockDate,
          statusHeight: 20,
          statusUpdatedAt: mintBlockDate
        },
        {
          owner: "akash1first",
          height: 10,
          sequence: 1,
          recipient: "solanaFirst",
          amountUakt: 5000000,
          status: "refunded",
          createdAt: firstBlockDate,
          statusHeight: 30,
          statusUpdatedAt: lastBlockDate
        }
      ]);
    });

    it("returns the largest transfers first and the most recent first among equal amounts", async () => {
      const { repository } = await setup();
      await createTransfers();

      const transfers = await repository.findSinkTransfers({ skip: 0, limit: 10, sort: "largest" });

      expect(transfers.map(transfer => transfer.owner)).toEqual(["akash1largest", "akash1latest", "akash1first"]);
    });

    it("returns the page of transfers that follows the skipped ones", async () => {
      const { repository } = await setup();
      await createTransfers();

      const transfers = await repository.findSinkTransfers({ skip: 1, limit: 1, sort: "latest" });

      expect(transfers.map(transfer => transfer.owner)).toEqual(["akash1largest"]);
    });
  });

  describe("countSinkTransfers", () => {
    it("returns the number of transfers", async () => {
      const { repository } = await setup();
      await createTransfers();

      const count = await repository.countSinkTransfers();

      expect(count).toBe(3);
    });

    it("returns zero when no transfer is indexed yet", async () => {
      const { repository } = await setup();

      const count = await repository.countSinkTransfers();

      expect(count).toBe(0);
    });
  });

  describe("findSinkUnbondingDailyAmounts", () => {
    it("returns per UTC day the AKT that started unbonding, completes unbonding net of cancellations, was cancelled and was sent to Solana", async () => {
      const { repository } = await setup();
      await createUnbondingsAndTransfers();

      const rows = await repository.findSinkUnbondingDailyAmounts();

      expect(sortRows(rows)).toEqual(
        sortRows([
          { series: "unbondStarted", date: "2026-11-01", amountUakt: 950 },
          { series: "unbondStarted", date: "2026-11-02", amountUakt: 80 },
          { series: "unbondCompleting", date: "2026-11-05", amountUakt: 500 },
          { series: "unbondCompleting", date: "2026-11-22", amountUakt: 420 },
          { series: "unbondCompleting", date: "2026-11-23", amountUakt: 0 },
          { series: "cancelled", date: "2026-11-02", amountUakt: 30 },
          { series: "cancelled", date: "2026-11-03", amountUakt: 80 },
          { series: "sentToSolana", date: "2026-11-12", amountUakt: 220 },
          { series: "sentBySendersWhoUnbonded", date: "2026-11-12", amountUakt: 160 }
        ])
      );
    });

    it("returns nothing when no unbonding or transfer is indexed yet", async () => {
      const { repository } = await setup();

      expect(await repository.findSinkUnbondingDailyAmounts()).toEqual([]);
    });
  });

  describe("findSinkUnbondingSummary", () => {
    it("returns the AKT still unbonding as of the latest processed block and how many senders also unbonded", async () => {
      const { repository } = await setup();
      await createUnbondingsAndTransfers();

      const summary = await repository.findSinkUnbondingSummary();

      expect(summary).toEqual({
        unbondingUakt: 420,
        unbondingDelegators: 2,
        senders: 3,
        sendersWhoUnbonded: 2,
        sentUakt: 220,
        sentBySendersWhoUnbondedUakt: 160
      });
    });

    it("returns zeros when no unbonding or transfer is indexed yet", async () => {
      const { repository } = await setup();

      expect(await repository.findSinkUnbondingSummary()).toEqual({
        unbondingUakt: 0,
        unbondingDelegators: 0,
        senders: 0,
        sendersWhoUnbonded: 0,
        sentUakt: 0,
        sentBySendersWhoUnbondedUakt: 0
      });
    });
  });

  async function createUnbondingsAndTransfers() {
    const validator = "akashvaloper1validator";
    const completesAfterLatestBlock = new Date("2026-11-22T10:00:00Z");
    await createAkashBlock({ height: 10, datetime: new Date("2026-11-01T10:00:00Z"), isProcessed: true });
    await createAkashBlock({ height: 20, datetime: new Date("2026-11-02T09:00:00Z"), isProcessed: true });
    await createAkashBlock({ height: 25, datetime: new Date("2026-11-03T09:00:00Z"), isProcessed: true });
    await createAkashBlock({ height: 30, datetime: new Date("2026-11-12T08:00:00Z"), isProcessed: true });
    await createAkashBlock({ height: 40, datetime: new Date("2026-11-12T20:00:00Z"), isProcessed: true });
    await createAkashBlock({ height: 50, datetime: new Date("2026-11-30T00:00:00Z"), isProcessed: false });

    await createStakingUnbonding({ height: 10, delegator: "akash1alice", validator, amount: "100", completionTime: completesAfterLatestBlock });
    await createStakingUnbonding({ height: 10, delegator: "akash1alice", validator, amount: "50", completionTime: completesAfterLatestBlock });
    await createStakingUnbonding({ height: 20, type: "cancel", delegator: "akash1alice", validator, amount: "30", creationHeight: 10 });
    await createStakingUnbonding({ height: 10, delegator: "akash1bob", validator, amount: "300", completionTime: new Date("2026-11-22T12:00:00Z") });
    await createStakingUnbonding({ height: 10, delegator: "akash1carol", validator, amount: "450", completionTime: new Date("2026-11-05T10:00:00Z") });
    await createStakingUnbonding({
      height: 10,
      delegator: "akash1carol",
      validator: "akashvaloper1other",
      amount: "50",
      completionTime: new Date("2026-11-05T11:00:00Z")
    });
    await createStakingUnbonding({ height: 20, delegator: "akash1eve", validator, amount: "80", completionTime: new Date("2026-11-23T09:00:00Z") });
    await createStakingUnbonding({ height: 25, type: "cancel", delegator: "akash1eve", validator, amount: "80", creationHeight: 20 });

    await createSinkTransfer({ height: 30, sequence: 1, owner: "akash1alice", amount: "120", status: "minted" });
    await createSinkTransfer({ height: 30, sequence: 2, owner: "akash1carol", amount: "40", status: "pending" });
    await createSinkTransfer({ height: 30, sequence: 3, owner: "akash1frank", amount: "60", status: "minted" });
    await createSinkTransfer({ height: 30, sequence: 4, owner: "akash1dave", amount: "999", status: "voided" });
    await createSinkTransfer({ height: 40, sequence: 1, owner: "akash1bob", amount: "70", status: "refunded" });
    await createSinkTransfer({ height: 40, sequence: 2, owner: "akash1bob", amount: "75", status: "refund_pending" });
  }

  function sortRows<T extends { series: string; date: string }>(rows: T[]) {
    return [...rows].sort((a, b) => `${a.series}${a.date}`.localeCompare(`${b.series}${b.date}`));
  }

  async function createTransfers() {
    const firstBlockDate = new Date("2026-11-11T10:00:00Z");
    const mintBlockDate = new Date("2026-11-11T10:03:00Z");
    const lastBlockDate = new Date("2026-11-11T11:00:00Z");
    await createAkashBlock({ height: 10, datetime: firstBlockDate, isProcessed: true });
    await createAkashBlock({ height: 20, datetime: mintBlockDate, isProcessed: true });
    await createAkashBlock({ height: 30, datetime: lastBlockDate, isProcessed: true });
    await createSinkTransfer({
      height: 10,
      sequence: 1,
      owner: "akash1first",
      recipient: "solanaFirst",
      amount: "5000000",
      status: "refunded",
      statusHeight: 30
    });
    await createSinkTransfer({
      height: 10,
      sequence: 2,
      owner: "akash1largest",
      recipient: "solanaLargest",
      amount: "975031000000",
      status: "minted",
      statusHeight: 20
    });
    await createSinkTransfer({ height: 30, sequence: 1, owner: "akash1latest", recipient: "solanaLatest", amount: "5000000" });

    return { firstBlockDate, mintBlockDate, lastBlockDate };
  }

  function zeroDashboardTotals() {
    return { ...zeroTotals(), medianSecondsToMint: null };
  }

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
      refundedTransfers: 0,
      uniqueSenders: 0
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
    await chainDb.query('TRUNCATE "staking_unbonding", "sink_transfer", "sink_totals_snapshot", "block", "day" CASCADE');

    return { repository: container.resolve(StatsRepository) };
  }
});

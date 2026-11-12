import { describe, expect, it } from "vitest";

import {
  MIGRATION_HERO_METRICS,
  MIGRATION_TRANSFER_SORTS,
  MIGRATION_TRANSFERS_PAGE_SIZE,
  nextTransfersLimit,
  toMigrationActivityCards,
  toMigrationStateCards,
  toMigrationSummaryCards,
  toMigrationTransferRows
} from "./solanaMigrationModel";

import type { SinkDashboardData, SinkPeriodData, SinkTransfer, SinkTransferStatus } from "@/types";

describe("solanaMigrationModel", () => {
  describe("MIGRATION_HERO_METRICS", () => {
    it("charts the minted amounts and transfer counts, keyed by their graph series", () => {
      expect(MIGRATION_HERO_METRICS.map(({ key, label, graphPath, latestPointLabel }) => ({ key, label, graphPath, latestPointLabel }))).toEqual([
        { key: "sinkMintedUakt", label: "AKT migrated", graphPath: "/solana-migration-graph/akt-migrated", latestPointLabel: "NOW" },
        { key: "dailySinkMintedUakt", label: "AKT migrated / day", graphPath: "/solana-migration-graph/daily-akt-migrated", latestPointLabel: "LAST 24H" },
        { key: "sinkMintedTransfers", label: "Transfers", graphPath: "/solana-migration-graph/transfers", latestPointLabel: "NOW" },
        { key: "dailySinkMintedTransfers", label: "Transfers / day", graphPath: "/solana-migration-graph/daily-transfers", latestPointLabel: "LAST 24H" }
      ]);
    });

    it("scales and formats AKT amounts from uakt and transfer counts as they are", () => {
      const [migratedAkt, , transfers] = MIGRATION_HERO_METRICS;

      expect(migratedAkt.scale(1_612_541_902_979)).toBeCloseTo(1_612_541.902979);
      expect(migratedAkt.formatValue(1_612_541.9)).toBe("1.61M AKT");
      expect(migratedAkt.formatAxisValue(1_612_541.9)).toBe("1.61M");
      expect(transfers.scale(27)).toBe(27);
      expect(transfers.formatValue(1027)).toBe("1,027");
    });
  });

  describe(toMigrationSummaryCards.name, () => {
    it("shows the migrated AKT with its USD value and the transfer counts", () => {
      const cards = toMigrationSummaryCards(sinkData(), 0.5);

      expect(cards.map(({ label, value, unit, detail, graphPath }) => ({ label, value, unit, detail, graphPath }))).toEqual([
        { label: "AKT migrated", value: "1.61M", unit: "AKT", detail: "$806.3K", graphPath: "/solana-migration-graph/akt-migrated" },
        { label: "AKT migrated · 24h", value: "412.0K", unit: "AKT", detail: "$206.0K", graphPath: "/solana-migration-graph/daily-akt-migrated" },
        { label: "Transfers", value: "27", unit: undefined, detail: undefined, graphPath: "/solana-migration-graph/transfers" },
        { label: "Transfers · 24h", value: "9", unit: undefined, detail: undefined, graphPath: "/solana-migration-graph/daily-transfers" }
      ]);
    });

    it("compares each value with the one from 24 hours earlier", () => {
      const cards = toMigrationSummaryCards(
        sinkData({ compare: { mintedUakt: 1_200_000_000_000, dailyMintedUakt: 824_000_000_000, mintedTransfers: 18, dailyMintedTransfers: 6 } }),
        0.5
      );

      expect(cards.map(card => card.diffPercent)).toEqual([0.3438, -0.5, 0.5, 0.5]);
    });

    it("explains every card", () => {
      expect(toMigrationSummaryCards(sinkData(), 0.5).map(card => card.tooltip)).toEqual([
        "AKT escrowed on Akash and minted on Solana, all-time",
        "AKT minted on Solana in the last 24 hours",
        "Migration transfers minted on Solana, all-time",
        "Migration transfers minted on Solana in the last 24 hours"
      ]);
    });

    it("leaves the USD value out while the AKT price is unknown", () => {
      expect(toMigrationSummaryCards(sinkData(), 0).map(card => card.detail)).toEqual([undefined, undefined, undefined, undefined]);
    });

    it("shows placeholders and keeps the graph links before the totals load", () => {
      const cards = toMigrationSummaryCards(undefined, 0.5);

      expect(cards.map(({ value, detail, diffPercent }) => ({ value, detail, diffPercent }))).toEqual(
        Array(4).fill({ value: "—", detail: undefined, diffPercent: undefined })
      );
      expect(cards.map(card => card.graphPath)).toEqual([
        "/solana-migration-graph/akt-migrated",
        "/solana-migration-graph/daily-akt-migrated",
        "/solana-migration-graph/transfers",
        "/solana-migration-graph/daily-transfers"
      ]);
    });
  });

  describe(toMigrationStateCards.name, () => {
    it("shows the AKT and the number of transfers in each other state", () => {
      const cards = toMigrationStateCards(
        sinkData({
          now: {
            pendingUakt: 2_500_000_000,
            pendingTransfers: 3,
            voidedUakt: 0,
            voidedTransfers: 0,
            refundPendingUakt: 1_000_000,
            refundPendingTransfers: 1,
            refundedUakt: 45_000_000_000,
            refundedTransfers: 1204
          }
        })
      );

      expect(cards.map(({ label, value, unit, detail, graphPath }) => ({ label, value, unit, detail, graphPath }))).toEqual([
        { label: "Pending mint", value: "2,500", unit: "AKT", detail: "3 transfers", graphPath: "/solana-migration-graph/akt-pending" },
        { label: "Voided", value: "0", unit: "AKT", detail: "0 transfers", graphPath: "/solana-migration-graph/akt-voided" },
        { label: "Awaiting refund", value: "1", unit: "AKT", detail: "1 transfer", graphPath: "/solana-migration-graph/akt-refund-pending" },
        { label: "Refunded", value: "45.0K", unit: "AKT", detail: "1,204 transfers", graphPath: "/solana-migration-graph/akt-refunded" }
      ]);
    });

    it("explains every state", () => {
      expect(toMigrationStateCards(sinkData()).map(card => card.tooltip)).toEqual([
        "AKT deposited for migration and not yet confirmed as minted on Solana",
        "AKT in transfers voided by governance and awaiting confirmation on Solana",
        "AKT authorized for a refund on Akash and still in its challenge period",
        "AKT refunded to its original owner on Akash, all-time"
      ]);
    });

    it("shows placeholders before the totals load", () => {
      expect(toMigrationStateCards(undefined).map(({ value, detail }) => ({ value, detail }))).toEqual(Array(4).fill({ value: "—", detail: undefined }));
    });
  });

  describe(toMigrationActivityCards.name, () => {
    it("shows how many addresses are migrating and how long a mint typically takes", () => {
      const cards = toMigrationActivityCards(sinkData({ compare: { uniqueSenders: 8 } }));

      expect(cards).toEqual([
        {
          label: "Migrating addresses",
          value: "10",
          tooltip: "Akash addresses that have started a migration transfer, all-time",
          graphPath: "/solana-migration-graph/migrating-addresses",
          diffPercent: 0.25
        },
        {
          label: "Median time to mint",
          value: "2m 24s",
          tooltip: "Typical time from a transfer being created on Akash to its mint being confirmed on Solana"
        }
      ]);
    });

    it("shows a dash for the time to mint while no transfer is minted", () => {
      const [, medianTimeToMint] = toMigrationActivityCards(sinkData({ now: { medianSecondsToMint: null } }));

      expect(medianTimeToMint.value).toBe("—");
    });

    it("shows placeholders before the totals load", () => {
      const cards = toMigrationActivityCards(undefined);

      expect(cards.map(({ value, diffPercent }) => ({ value, diffPercent }))).toEqual(Array(2).fill({ value: "—", diffPercent: undefined }));
    });
  });

  describe("MIGRATION_TRANSFER_SORTS", () => {
    it("offers the latest transfers first, then the largest", () => {
      expect(MIGRATION_TRANSFER_SORTS).toEqual([
        { value: "latest", label: "Latest", title: "Latest transfers" },
        { value: "largest", label: "Largest", title: "Largest transfers" }
      ]);
    });
  });

  describe(nextTransfersLimit.name, () => {
    it("starts from a page of ten transfers", () => {
      expect(MIGRATION_TRANSFERS_PAGE_SIZE).toBe(10);
    });

    it.each([
      [10, 27, 20],
      [20, 27, 30],
      [10, 11, 20],
      [90, 250, 100],
      [95, 250, 100]
    ])("grows a limit of %d to the next page when there are %d transfers", (limit, transferCount, expected) => {
      expect(nextTransfersLimit(limit, transferCount)).toBe(expected);
    });

    it.each([
      [30, 27],
      [10, 10],
      [10, 0],
      [100, 250],
      [100, 100]
    ])("has no next page at a limit of %d with %d transfers", (limit, transferCount) => {
      expect(nextTransfersLimit(limit, transferCount)).toBeUndefined();
    });

    it("has no next page before the transfers load", () => {
      expect(nextTransfersLimit(10, undefined)).toBeUndefined();
    });
  });

  describe(toMigrationTransferRows.name, () => {
    it("describes a minted transfer with its shortened addresses, amount and time to mint", () => {
      expect(toMigrationTransferRows([sinkTransfer()])).toEqual([
        {
          key: "29448411-1",
          owner: "akash1qqzwc5d7hynl67nsmn9jukvwqp3vzdl6j2t7lk",
          ownerLabel: "akash1…t7lk",
          recipient: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          recipientLabel: "7xKXtg…gAsU",
          amount: "975,031 AKT",
          statusLabel: "Minted",
          isMinted: true,
          timeToMint: "2m 24s",
          height: 29448411,
          createdAt: Date.UTC(2026, 10, 11, 10, 0, 0)
        }
      ]);
    });

    it.each<[SinkTransferStatus, string]>([
      ["pending", "Pending mint"],
      ["voided", "Voided"],
      ["refund_pending", "Awaiting refund"],
      ["refunded", "Refunded"]
    ])("labels a %s transfer as %s without a time to mint", (status, statusLabel) => {
      const [row] = toMigrationTransferRows([sinkTransfer({ status })]);

      expect(row).toMatchObject({ statusLabel, isMinted: false, timeToMint: "—" });
    });

    it.each([
      [1_500_000, "1.5 AKT"],
      [1_234_567_890, "1,234.57 AKT"],
      [5_000_000, "5 AKT"]
    ])("prints %d uakt as %s", (amountUakt, amount) => {
      const [row] = toMigrationTransferRows([sinkTransfer({ amountUakt })]);

      expect(row.amount).toBe(amount);
    });

    it("tells transfers created in the same block apart by their sequence", () => {
      const rows = toMigrationTransferRows([sinkTransfer({ sequence: 1 }), sinkTransfer({ sequence: 2 })]);

      expect(rows.map(row => row.key)).toEqual(["29448411-1", "29448411-2"]);
    });
  });

  function sinkTransfer(input?: Partial<SinkTransfer>): SinkTransfer {
    return {
      owner: "akash1qqzwc5d7hynl67nsmn9jukvwqp3vzdl6j2t7lk",
      height: 29448411,
      sequence: 1,
      recipient: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      amountUakt: 975_031_000_000,
      status: "minted",
      createdAt: "2026-11-11T10:00:00.000Z",
      statusHeight: 29448435,
      statusUpdatedAt: "2026-11-11T10:02:24.000Z",
      ...input
    };
  }

  function sinkData(input?: { now?: Partial<SinkPeriodData>; compare?: Partial<SinkPeriodData> }): SinkDashboardData {
    const period: SinkPeriodData = {
      date: "2026-11-12T04:00:00.000Z",
      mintedUakt: 1_612_541_902_979,
      dailyMintedUakt: 412_000_000_000,
      mintedTransfers: 27,
      dailyMintedTransfers: 9,
      pendingUakt: 0,
      pendingTransfers: 0,
      voidedUakt: 0,
      voidedTransfers: 0,
      refundPendingUakt: 0,
      refundPendingTransfers: 0,
      refundedUakt: 0,
      refundedTransfers: 0,
      uniqueSenders: 10,
      medianSecondsToMint: 144
    };

    return { now: { ...period, ...input?.now }, compare: { ...period, ...input?.compare } };
  }
});

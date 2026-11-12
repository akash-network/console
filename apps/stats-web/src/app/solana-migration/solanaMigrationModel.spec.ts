import { describe, expect, it } from "vitest";

import { MIGRATION_HERO_METRICS, toMigrationStateCards, toMigrationSummaryCards } from "./solanaMigrationModel";

import type { SinkDashboardData, SinkPeriodData } from "@/types";

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
      refundedTransfers: 0
    };

    return { now: { ...period, ...input?.now }, compare: { ...period, ...input?.compare } };
  }
});

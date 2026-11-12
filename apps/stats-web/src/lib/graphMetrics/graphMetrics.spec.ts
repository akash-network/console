import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GraphMetric } from "./graphMetrics";
import { findGraphMetric, GRAPH_METRICS, graphMetricHref, groupGraphMetrics } from "./graphMetrics";

import type { BmeDashboardData, DashboardData, SinkDashboardData } from "@/types";
import { BmeSnapshotsUrlParam, ProviderSnapshotsUrlParam, SinkSnapshotsUrlParam, SnapshotsUrlParam } from "@/types/snapshots";

describe("graphMetrics", () => {
  const dashboard = mock<DashboardData>({
    now: {
      dailyUUsdSpent: 8_232_000_000,
      totalUUsdSpent: 6_600_000_000_000,
      dailyUActSpent: 8_000_000_000,
      totalUActSpent: 2_820_000_000_000,
      dailyUAktSpent: 0,
      totalUAktSpent: 2_810_000_000_000,
      activeLeaseCount: 642,
      dailyLeaseCount: 1046,
      totalLeaseCount: 642_000,
      activeGPU: 184,
      activeCPU: 2_540_000,
      activeMemory: 16.1e12,
      activeStorage: 48.7e12
    },
    networkCapacity: { activeProviderCount: 51, totalGPU: 396, totalCPU: 14_390_000, totalMemory: 81.9e12, totalStorage: 612e12 }
  });
  const bme = mock<BmeDashboardData>({ now: { outstandingAct: 272_069_226_813, collateralRatio: 1.557836, vaultAkt: 680_288_111_379 } });
  const sink = mock<SinkDashboardData>({
    now: {
      mintedUakt: 1_612_541_902_979,
      dailyMintedUakt: 412_000_000_000,
      mintedTransfers: 27,
      dailyMintedTransfers: 9,
      pendingUakt: 2_500_000,
      voidedUakt: 0,
      refundPendingUakt: 1_000_000,
      refundedUakt: 750_000,
      uniqueSenders: 10
    }
  });

  it.each([
    ["graph", SnapshotsUrlParam.dailyUsdSpent, 8232, "$8,232", "$8,232"],
    ["graph", SnapshotsUrlParam.totalUSDSpent, 6_600_000, "$6,600,000", "$6.60M"],
    ["graph", SnapshotsUrlParam.dailyActSpent, 8000, "8,000 ACT", "8,000"],
    ["graph", SnapshotsUrlParam.totalACTSpent, 2_820_000, "2.82M ACT", "2.82M"],
    ["graph", SnapshotsUrlParam.dailyAktSpent, 0, "0 AKT", "0"],
    ["graph", SnapshotsUrlParam.totalAKTSpent, 2_810_000, "2.81M AKT", "2.81M"],
    ["graph", SnapshotsUrlParam.activeLeases, 642, "642", "642"],
    ["graph", SnapshotsUrlParam.dailyDeploymentCount, 1046, "1,046", "1,046"],
    ["graph", SnapshotsUrlParam.allTimeDeploymentCount, 642_000, "642,000", "642.0K"],
    ["graph", SnapshotsUrlParam.graphics, 184, "184", "184"],
    ["graph", SnapshotsUrlParam.compute, 2540, "2,540 vCPU", "2,540"],
    ["graph", SnapshotsUrlParam.memory, 16.1e12, "16.1 TB", "16.1 TB"],
    ["graph", SnapshotsUrlParam.storage, 48.7e12, "48.7 TB", "48.7 TB"],
    ["provider-graph", ProviderSnapshotsUrlParam.count, 51, "51", "51"],
    ["provider-graph", ProviderSnapshotsUrlParam.gpu, 396, "396", "396"],
    ["provider-graph", ProviderSnapshotsUrlParam.cpu, 14_390, "14,390 vCPU", "14.4K"],
    ["provider-graph", ProviderSnapshotsUrlParam.memory, 81.9e12, "81.9 TB", "81.9 TB"],
    ["provider-graph", ProviderSnapshotsUrlParam.storage, 612e12, "612 TB", "612 TB"]
  ] as const)("reads and formats the current %s value of %s", (kind, urlParam, current, formattedValue, formattedAxis) => {
    const metric = findGraphMetric(kind, urlParam)!;

    expect(metric.readCurrent({ dashboard })).toBeCloseTo(current);
    expect(metric.formatValue(current)).toBe(formattedValue);
    expect(metric.formatAxisValue(current)).toBe(formattedAxis);
  });

  it("reads nothing before the dashboard data loads", () => {
    expect(GRAPH_METRICS.filter(metric => metric.kind === "graph" || metric.kind === "provider-graph").map(metric => metric.readCurrent({}))).toEqual(
      Array(18).fill(undefined)
    );
  });

  it.each([
    [SnapshotsUrlParam.dailyUsdSpent, 2_500_000, 2.5],
    [SnapshotsUrlParam.compute, 2500, 2.5],
    [SnapshotsUrlParam.activeLeases, 7, 7],
    [SnapshotsUrlParam.dailyAktSpent, 3_000_000, 3]
  ])("scales %s series values", (urlParam, raw, scaled) => {
    expect(findGraphMetric("graph", urlParam)!.scale(raw)).toBe(scaled);
  });

  describe("burn mint equilibrium", () => {
    it("reads token amounts from micro denominations", () => {
      const metric = findGraphMetric("bme-graph", BmeSnapshotsUrlParam.outstandingAct)!;

      expect(metric.readCurrent({ bme })).toBeCloseTo(272_069.226813);
      expect(metric.scale(1_000_000)).toBe(1);
      expect(metric.formatValue(272_069)).toBe("272.1K ACT");
      expect(metric.csvUnit).toBe("ACT");
    });

    it("reads the collateral ratio as it is", () => {
      const metric = findGraphMetric("bme-graph", BmeSnapshotsUrlParam.collateralRatio)!;

      expect(metric.readCurrent({ bme })).toBe(1.557836);
      expect(metric.scale(1.5)).toBe(1.5);
      expect(metric.formatValue(1.557836)).toBe("1.56");
      expect(metric.formatAxisValue(1.5)).toBe("1.50");
      expect(metric.csvUnit).toBe("ratio");
    });

    it("reads nothing before the bme data loads", () => {
      expect(findGraphMetric("bme-graph", BmeSnapshotsUrlParam.vaultAkt)!.readCurrent({})).toBeUndefined();
    });

    it("covers every bme snapshot", () => {
      expect(GRAPH_METRICS.filter(metric => metric.kind === "bme-graph").map(metric => metric.urlParam)).toEqual(
        expect.arrayContaining(Object.values(BmeSnapshotsUrlParam))
      );
    });
  });

  describe("solana migration", () => {
    it.each([
      [SinkSnapshotsUrlParam.mintedUakt, "sinkMintedUakt", 1_612_541.902979, "1.61M AKT", "AKT"],
      [SinkSnapshotsUrlParam.dailyMintedUakt, "dailySinkMintedUakt", 412_000, "412.0K AKT", "AKT"],
      [SinkSnapshotsUrlParam.mintedTransfers, "sinkMintedTransfers", 27, "27", "count"],
      [SinkSnapshotsUrlParam.dailyMintedTransfers, "dailySinkMintedTransfers", 9, "9", "count"],
      [SinkSnapshotsUrlParam.pendingUakt, "sinkPendingUakt", 2.5, "3 AKT", "AKT"],
      [SinkSnapshotsUrlParam.voidedUakt, "sinkVoidedUakt", 0, "0 AKT", "AKT"],
      [SinkSnapshotsUrlParam.refundPendingUakt, "sinkRefundPendingUakt", 1, "1 AKT", "AKT"],
      [SinkSnapshotsUrlParam.refundedUakt, "sinkRefundedUakt", 0.75, "1 AKT", "AKT"],
      [SinkSnapshotsUrlParam.uniqueSenders, "sinkUniqueSenders", 10, "10", "count"]
    ])("reads %s from the %s series and the sink totals", (urlParam, snapshot, current, formattedValue, csvUnit) => {
      const metric = findGraphMetric("solana-migration-graph", urlParam)!;

      expect(metric.snapshot).toBe(snapshot);
      expect(metric.readCurrent({ sink })).toBeCloseTo(current);
      expect(metric.formatValue(current)).toBe(formattedValue);
      expect(metric.csvUnit).toBe(csvUnit);
    });

    it("scales AKT series from uakt and leaves transfer counts as they are", () => {
      expect(findGraphMetric("solana-migration-graph", SinkSnapshotsUrlParam.mintedUakt)!.scale(1_000_000)).toBe(1);
      expect(findGraphMetric("solana-migration-graph", SinkSnapshotsUrlParam.mintedTransfers)!.scale(27)).toBe(27);
    });

    it("reads nothing before the sink totals load", () => {
      expect(GRAPH_METRICS.filter(metric => metric.kind === "solana-migration-graph").map(metric => metric.readCurrent({}))).toEqual(Array(9).fill(undefined));
    });

    it("covers every sink snapshot", () => {
      expect(GRAPH_METRICS.filter(metric => metric.kind === "solana-migration-graph").map(metric => metric.urlParam)).toEqual(
        Object.values(SinkSnapshotsUrlParam)
      );
    });
  });

  it("covers every graph and provider graph snapshot", () => {
    expect(GRAPH_METRICS.filter(metric => metric.kind === "graph")).toHaveLength(Object.values(SnapshotsUrlParam).length);
    expect(GRAPH_METRICS.filter(metric => metric.kind === "provider-graph")).toHaveLength(Object.values(ProviderSnapshotsUrlParam).length);
  });

  describe(findGraphMetric.name, () => {
    it("tells graphs of the same url apart by kind", () => {
      expect(findGraphMetric("graph", "memory")?.title).toBe("Memory under lease");
      expect(findGraphMetric("provider-graph", "memory")?.title).toBe("Memory capacity");
    });

    it("finds nothing for an unknown url", () => {
      expect(findGraphMetric("graph", "nope")).toBeUndefined();
    });
  });

  describe(graphMetricHref.name, () => {
    it("links to the graph route of its kind", () => {
      expect(graphMetricHref({ kind: "provider-graph", urlParam: "active-providers" })).toBe("/provider-graph/active-providers");
    });
  });

  describe(groupGraphMetrics.name, () => {
    it("groups metrics in the order they first appear", () => {
      const metric = (group: string, label: string) => mock<GraphMetric>({ group, label });

      expect(
        groupGraphMetrics([metric("A", "a1"), metric("B", "b1"), metric("A", "a2")]).map(({ name, metrics }) => [name, metrics.map(m => m.label)])
      ).toEqual([
        ["A", ["a1", "a2"]],
        ["B", ["b1"]]
      ]);
    });
  });
});

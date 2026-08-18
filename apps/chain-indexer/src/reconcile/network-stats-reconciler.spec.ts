import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { IndexerState, Leases, NetworkRollups, NetworkState } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import { NetworkStatsReconciler } from "@src/reconcile/network-stats-reconciler";

describe(NetworkStatsReconciler.name, () => {
  it("returns true when the state row matches the recomputation from leases", async () => {
    const { service, logger } = setup({});

    await expect(service.reconcile()).resolves.toBe(true);

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "NETWORK_RECONCILE_OK", mismatches: 0 }));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("treats differently formatted but equal numerics as matching", async () => {
    const { service } = setup({
      stateRow: stateRow({ totalUaktSpent: "1000.000000000000000000" }),
      spendRows: [{ denom: "uakt", earned: "1000" }]
    });

    await expect(service.reconcile()).resolves.toBe(true);
  });

  it("reports a lease count drift on the current state", async () => {
    const { service, logger } = setup({ leaseAggregates: [leaseAggregates({ activeLeaseCount: 4 })] });

    await expect(service.reconcile()).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "NETWORK_RECONCILE_MISMATCH", scope: "network_state", field: "activeLeaseCount", expected: "4", actual: "3" })
    );
  });

  it("reports a settlement-exact spend drift per denom", async () => {
    const { service, logger } = setup({ spendRows: [{ denom: "uakt", earned: "999" }] });

    await expect(service.reconcile()).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "NETWORK_RECONCILE_MISMATCH", field: "total_uakt_spent" }));
  });

  it("reports a provider count drift", async () => {
    const { service, logger } = setup({ providerCount: 7 });

    await expect(service.reconcile()).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "NETWORK_RECONCILE_MISMATCH", field: "activeProviderCount", expected: "7", actual: "5" })
    );
  });

  it("reports a watermark lagging the sync checkpoint", async () => {
    const { service, logger } = setup({ checkpoint: 250 });

    await expect(service.reconcile()).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "NETWORK_RECONCILE_MISMATCH", field: "lastAggregatedHeight", expected: "250", actual: "100" })
    );
  });

  it("re-derives sampled rollup rows at their close height", async () => {
    const { service, logger } = setup({
      rollups: [rollupRow({ date: "2026-08-13", activeGpuUnits: 9 })],
      leaseAggregates: [leaseAggregates({}), leaseAggregates({ activeGpuUnits: 2 })]
    });

    await expect(service.reconcile()).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "NETWORK_RECONCILE_MISMATCH", scope: "network_rollups:2026-08-13", field: "activeGpuUnits", expected: "2", actual: "9" })
    );
  });

  it("passes on an empty database with no state row", async () => {
    const { service, logger } = setup({ stateRow: null, leaseAggregates: [leaseAggregates({ activeLeaseCount: 0, totalLeaseCount: 0 })] });

    await expect(service.reconcile()).resolves.toBe(true);

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "NETWORK_RECONCILE_EMPTY" }));
  });

  it("fails when leases exist but the state row is missing", async () => {
    const { service, logger } = setup({ stateRow: null });

    await expect(service.reconcile()).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "NETWORK_RECONCILE_NO_STATE" }));
  });

  function setup(input: {
    stateRow?: Record<string, unknown> | null;
    leaseAggregates?: Record<string, unknown>[];
    spendRows?: { denom: string; earned: string }[];
    providerCount?: number;
    checkpoint?: number;
    rollups?: Record<string, unknown>[];
  }) {
    const leaseAggQueue = [...(input.leaseAggregates ?? [leaseAggregates({})])];

    const resolveRows = (table: unknown, grouped: boolean): unknown[] => {
      if (table === NetworkState) {
        return input.stateRow === null ? [] : [input.stateRow ?? stateRow({})];
      }
      if (table === IndexerState) {
        return [{ stream: "sync", lastHeight: input.checkpoint ?? 100 }];
      }
      if (table === NetworkRollups) {
        return input.rollups ?? [];
      }
      if (table === Leases && grouped) {
        return input.spendRows ?? [{ denom: "uakt", earned: "1000.000000000000000000" }];
      }
      if (table === Leases) {
        return [leaseAggQueue.shift() ?? leaseAggregates({})];
      }
      return [{ value: input.providerCount ?? 5 }];
    };

    const makeChain = (table: unknown) => {
      let grouped = false;
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => {
          grouped = true;
          return chain;
        },
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
          Promise.resolve(resolveRows(table, grouped)).then(resolve, reject)
      };
      return chain;
    };

    const tx = { select: () => ({ from: (table: unknown) => makeChain(table) }) };
    const dbFake = { transaction: async (callback: (transaction: unknown) => unknown) => callback(tx) };

    const logger = mock<LoggerService>();
    const service = new NetworkStatsReconciler(dbFake as unknown as ChainDatabase, logger);
    return { service, logger };
  }

  function stateRow(overrides: Record<string, unknown>) {
    return {
      id: 1,
      lastAggregatedHeight: 100,
      lastAggregatedAt: new Date("2026-08-13T10:00:00Z"),
      activeLeaseCount: 3,
      totalLeaseCount: 10,
      activeProviderCount: 5,
      activeCpuUnits: 10000,
      activeGpuUnits: 2,
      activeMemoryBytes: 10000,
      activeEphemeralStorageBytes: 1000,
      activePersistentStorageBytes: 1000,
      totalUaktSpent: "1000.000000000000000000",
      totalUusdcSpent: "0.000000000000000000",
      totalUactSpent: "0.000000000000000000",
      ...overrides
    };
  }

  function leaseAggregates(overrides: Record<string, unknown>) {
    return {
      activeLeaseCount: 3,
      totalLeaseCount: 10,
      activeCpuUnits: 10000,
      activeGpuUnits: 2,
      activeMemoryBytes: 10000,
      activeEphemeralStorageBytes: 1000,
      activePersistentStorageBytes: 1000,
      ...overrides
    };
  }

  function rollupRow(overrides: Record<string, unknown>) {
    return {
      date: "2026-08-13",
      closeHeight: 90,
      closeAt: new Date("2026-08-13T23:59:00Z"),
      activeLeaseCount: 3,
      totalLeaseCount: 10,
      dailyLeaseCount: 2,
      activeProviderCount: 5,
      activeCpuUnits: 10000,
      activeGpuUnits: 2,
      activeMemoryBytes: 10000,
      activeEphemeralStorageBytes: 1000,
      activePersistentStorageBytes: 1000,
      totalUaktSpent: "1000.000000000000000000",
      totalUusdcSpent: "0.000000000000000000",
      totalUactSpent: "0.000000000000000000",
      dailyUaktSpent: "1000.000000000000000000",
      dailyUusdcSpent: "0.000000000000000000",
      dailyUactSpent: "0.000000000000000000",
      dailyUsdSpent: null,
      aktPriceUsed: null,
      usdComputedAt: null,
      ...overrides
    };
  }
});

import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { decFromInt, decToString } from "@src/akash/dec";
import type { NetworkBlockDelta } from "@src/akash/network-delta";
import { NetworkRollups, NetworkState } from "@src/db/schema";
import type { DayCloseUsdService } from "@src/network/day-close-usd.service";
import { NetworkStatsWriter } from "@src/network/network-stats-writer.service";
import type { ChainTransaction } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(NetworkStatsWriter.name, () => {
  it("lazily initializes the singleton row with the watermark just below the first block", async () => {
    const { writer, tx, inserts, updates } = setup();

    await writer.write(tx, [block(100, "2026-08-13T10:00:00Z")], []);

    expect(rowsFor(inserts, NetworkState)).toEqual([
      expect.objectContaining({ id: 1, lastAggregatedHeight: 99, lastAggregatedAt: new Date("2026-08-13T10:00:00Z") })
    ]);
    expect(updates).toEqual([
      expect.objectContaining({ lastAggregatedHeight: 100, lastAggregatedAt: new Date("2026-08-13T10:00:00Z"), activeProviderCount: 5 })
    ]);
  });

  it("applies block deltas onto the running state", async () => {
    const { writer, tx, updates } = setup({ stateRow: stateRow({ lastAggregatedHeight: 100 }) });

    await writer.write(
      tx,
      [block(101, "2026-08-13T10:00:00Z")],
      [
        delta(101, {
          leasesCreated: 2,
          activeLeaseDelta: 1,
          cpuUnitsDelta: 2000,
          gpuUnitsDelta: 1,
          memoryBytesDelta: 1024,
          ephemeralStorageBytesDelta: 100,
          persistentStorageBytesDelta: 50,
          earnedDeltaByDenom: new Map([
            ["uakt", decFromInt(900)],
            ["uusdc", decFromInt(30)]
          ])
        })
      ]
    );

    expect(updates).toEqual([
      {
        lastAggregatedHeight: 101,
        lastAggregatedAt: new Date("2026-08-13T10:00:00Z"),
        activeLeaseCount: 4,
        totalLeaseCount: 12,
        activeProviderCount: 5,
        activeCpuUnits: 12000,
        activeGpuUnits: 3,
        activeMemoryBytes: 11024,
        activeEphemeralStorageBytes: 1100,
        activePersistentStorageBytes: 1050,
        totalUaktSpent: decToString(decFromInt(1900)),
        totalUusdcSpent: decToString(decFromInt(30)),
        totalUactSpent: decToString(0n)
      }
    ]);
  });

  it("warns and drops earnings in an unknown denom", async () => {
    const { writer, tx, updates, logger } = setup({ stateRow: stateRow({ lastAggregatedHeight: 100 }) });

    await writer.write(tx, [block(101, "2026-08-13T10:00:00Z")], [delta(101, { earnedDeltaByDenom: new Map([["ibc/deadbeef", decFromInt(5)]]) })]);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "NETWORK_STATS_UNKNOWN_SPEND_DENOM", denom: "ibc/deadbeef" }));
    expect(updates[0]).toMatchObject({ totalUaktSpent: decToString(decFromInt(1000)) });
  });

  it("closes the previous day when a batch crosses a UTC boundary", async () => {
    const { writer, tx, inserts, dayCloseUsd } = setup({ stateRow: stateRow({ lastAggregatedHeight: 100 }), providerCounts: [4, 5] });

    await writer.write(
      tx,
      [block(101, "2026-08-13T23:59:55Z"), block(102, "2026-08-14T00:00:05Z")],
      [delta(101, { leasesCreated: 1, activeLeaseDelta: 1, earnedDeltaByDenom: new Map([["uakt", decFromInt(100)]]) })]
    );

    expect(rowsFor(inserts, NetworkRollups)).toEqual([
      {
        date: "2026-08-13",
        closeHeight: 101,
        closeAt: new Date("2026-08-13T23:59:55Z"),
        activeLeaseCount: 4,
        totalLeaseCount: 11,
        dailyLeaseCount: 11,
        activeProviderCount: 4,
        activeCpuUnits: 10000,
        activeGpuUnits: 2,
        activeMemoryBytes: 10000,
        activeEphemeralStorageBytes: 1000,
        activePersistentStorageBytes: 1000,
        totalUaktSpent: decToString(decFromInt(1100)),
        totalUusdcSpent: decToString(0n),
        totalUactSpent: decToString(0n),
        dailyUaktSpent: decToString(decFromInt(1100)),
        dailyUusdcSpent: decToString(0n),
        dailyUactSpent: decToString(0n)
      }
    ]);
    expect(dayCloseUsd.recompute).toHaveBeenCalledWith(tx, "2026-08-13");
  });

  it("closes a day whose last block belongs to a previous batch", async () => {
    const { writer, tx, inserts } = setup({
      stateRow: stateRow({ lastAggregatedHeight: 100, lastAggregatedAt: new Date("2026-08-13T23:59:55Z") })
    });

    await writer.write(tx, [block(101, "2026-08-14T00:00:05Z")], []);

    expect(rowsFor(inserts, NetworkRollups)).toEqual([
      expect.objectContaining({ date: "2026-08-13", closeHeight: 100, closeAt: new Date("2026-08-13T23:59:55Z") })
    ]);
  });

  it("computes daily deltas against the previous rollup row", async () => {
    const { writer, tx, inserts } = setup({
      stateRow: stateRow({ lastAggregatedHeight: 100, lastAggregatedAt: new Date("2026-08-13T23:59:55Z") }),
      rollups: [rollupRow({ date: "2026-08-12", totalLeaseCount: 8, totalUaktSpent: decToString(decFromInt(400)) })]
    });

    await writer.write(tx, [block(101, "2026-08-14T00:00:05Z")], []);

    expect(rowsFor(inserts, NetworkRollups)).toEqual([
      expect.objectContaining({
        date: "2026-08-13",
        dailyLeaseCount: 2,
        dailyUaktSpent: decToString(decFromInt(600)),
        totalUaktSpent: decToString(decFromInt(1000))
      })
    ]);
  });

  it("closes each crossed day once and only for days that had blocks", async () => {
    const { writer, tx, inserts } = setup({ stateRow: stateRow({ lastAggregatedHeight: 100 }), providerCounts: [5, 5, 5] });

    await writer.write(tx, [block(101, "2026-08-13T23:59:55Z"), block(102, "2026-08-16T00:00:05Z"), block(103, "2026-08-17T00:00:05Z")], []);

    expect(rowsFor(inserts, NetworkRollups).map(row => [row.date, row.closeHeight])).toEqual([
      ["2026-08-13", 101],
      ["2026-08-16", 102]
    ]);
  });

  it("does nothing beyond locking when every block is at or below the watermark", async () => {
    const { writer, tx, inserts, updates, dayCloseUsd } = setup({ stateRow: stateRow({ lastAggregatedHeight: 200 }) });

    await writer.write(tx, [block(101, "2026-08-14T10:00:00Z")], [delta(101, { activeLeaseDelta: 1 })]);

    expect(rowsFor(inserts, NetworkRollups)).toEqual([]);
    expect(updates).toEqual([]);
    expect(dayCloseUsd.recompute).not.toHaveBeenCalled();
  });

  function setup(input?: { stateRow?: Record<string, unknown>; rollups?: Record<string, unknown>[]; providerCounts?: number[] }) {
    const inserts: { table: unknown; rows: Record<string, unknown>[] }[] = [];
    const updates: Record<string, unknown>[] = [];
    const stateRows: Record<string, unknown>[] = input?.stateRow ? [input.stateRow] : [];
    const rollupRows: Record<string, unknown>[] = [...(input?.rollups ?? [])];
    const providerCounts = [...(input?.providerCounts ?? [])];

    const rowsFromTable = (table: unknown) => {
      if (table === NetworkState) {
        return stateRows;
      }
      if (table === NetworkRollups) {
        return [...rollupRows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      }
      return [{ value: providerCounts.shift() ?? 5 }];
    };

    const selectChain = (table: unknown) => {
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        for: () => chain,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(rowsFromTable(table)).then(resolve, reject)
      };
      return chain;
    };

    const tx = {
      insert: (table: unknown) => ({
        values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows: rowArray });
          if (table === NetworkState && stateRows.length === 0) {
            stateRows.push({ ...emptyStateRow(), ...rowArray[0] });
          }
          if (table === NetworkRollups) {
            rollupRows.push(...rowArray);
          }
          return { onConflictDoNothing: () => Promise.resolve() };
        }
      }),
      select: () => ({ from: (table: unknown) => selectChain(table) }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => {
          void table;
          updates.push(values);
          return { where: () => Promise.resolve() };
        }
      })
    };

    const dayCloseUsd = mock<DayCloseUsdService>();
    const logger = mock<LoggerService>();
    const writer = new NetworkStatsWriter(dayCloseUsd, logger);
    return { writer, tx: tx as unknown as ChainTransaction, inserts, updates, dayCloseUsd, logger };
  }

  function block(height: number, datetime: string) {
    return { height, datetime: new Date(datetime) };
  }

  function delta(height: number, overrides: Partial<NetworkBlockDelta>): NetworkBlockDelta {
    return {
      height,
      leasesCreated: 0,
      activeLeaseDelta: 0,
      cpuUnitsDelta: 0,
      gpuUnitsDelta: 0,
      memoryBytesDelta: 0,
      ephemeralStorageBytesDelta: 0,
      persistentStorageBytesDelta: 0,
      earnedDeltaByDenom: new Map(),
      ...overrides
    };
  }

  function stateRow(overrides: Record<string, unknown>) {
    return {
      id: 1,
      lastAggregatedHeight: 100,
      lastAggregatedAt: new Date("2026-08-13T09:00:00Z"),
      activeLeaseCount: 3,
      totalLeaseCount: 10,
      activeProviderCount: 5,
      activeCpuUnits: 10000,
      activeGpuUnits: 2,
      activeMemoryBytes: 10000,
      activeEphemeralStorageBytes: 1000,
      activePersistentStorageBytes: 1000,
      totalUaktSpent: decToString(decFromInt(1000)),
      totalUusdcSpent: decToString(0n),
      totalUactSpent: decToString(0n),
      ...overrides
    };
  }

  function rollupRow(overrides: Record<string, unknown>) {
    return {
      date: "2026-08-12",
      closeHeight: 90,
      closeAt: new Date("2026-08-12T23:59:00Z"),
      activeLeaseCount: 2,
      totalLeaseCount: 8,
      dailyLeaseCount: 8,
      activeProviderCount: 4,
      activeCpuUnits: 8000,
      activeGpuUnits: 1,
      activeMemoryBytes: 8000,
      activeEphemeralStorageBytes: 800,
      activePersistentStorageBytes: 800,
      totalUaktSpent: decToString(decFromInt(400)),
      totalUusdcSpent: decToString(0n),
      totalUactSpent: decToString(0n),
      dailyUaktSpent: decToString(decFromInt(400)),
      dailyUusdcSpent: decToString(0n),
      dailyUactSpent: decToString(0n),
      dailyUsdSpent: null,
      aktPriceUsed: null,
      usdComputedAt: null,
      ...overrides
    };
  }

  function emptyStateRow() {
    return {
      activeLeaseCount: 0,
      totalLeaseCount: 0,
      activeProviderCount: 0,
      activeCpuUnits: 0,
      activeGpuUnits: 0,
      activeMemoryBytes: 0,
      activeEphemeralStorageBytes: 0,
      activePersistentStorageBytes: 0,
      totalUaktSpent: "0",
      totalUusdcSpent: "0",
      totalUactSpent: "0"
    };
  }

  function rowsFor(inserts: { table: unknown; rows: Record<string, unknown>[] }[], table: unknown): Record<string, unknown>[] {
    return inserts.filter(insert => insert.table === table).flatMap(insert => insert.rows);
  }
});

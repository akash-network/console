import type { Meter, ObservableCallback, ObservableGauge, ObservableResult } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { registerSyncLagGauges, SyncLagMetrics } from "@src/pipeline/sync-lag-metrics";

describe(SyncLagMetrics.name, () => {
  it("reports nothing before sync has committed a block", () => {
    const lag = new SyncLagMetrics();
    lag.recordTip(100);

    expect(lag.read(new Date("2026-09-26T12:00:00Z"))).toBeUndefined();
  });

  it("reports the committed height, the blocks behind the tip and the seconds since the committed block", () => {
    const lag = new SyncLagMetrics();
    lag.recordTip(105);
    lag.recordCommitted(100, new Date("2026-09-26T12:00:00Z"));

    expect(lag.read(new Date("2026-09-26T12:00:30Z"))).toEqual({ committedHeight: 100, lagBlocks: 5, lagSeconds: 30 });
  });

  it("keeps growing the lag in seconds while no new block commits", () => {
    const lag = new SyncLagMetrics();
    lag.recordTip(100);
    lag.recordCommitted(100, new Date("2026-09-26T12:00:00Z"));

    expect(lag.read(new Date("2026-09-26T12:10:00Z"))?.lagSeconds).toBe(600);
  });

  it("reports no block lag until the tip is known", () => {
    const lag = new SyncLagMetrics();
    lag.recordCommitted(100, new Date("2026-09-26T12:00:00Z"));

    expect(lag.read(new Date("2026-09-26T12:00:06Z"))).toEqual({ committedHeight: 100, lagBlocks: undefined, lagSeconds: 6 });
  });

  it("never reports a negative lag when a node reports a tip below the committed height", () => {
    const lag = new SyncLagMetrics();
    lag.recordTip(98);
    lag.recordCommitted(100, new Date("2026-09-26T12:00:10Z"));

    expect(lag.read(new Date("2026-09-26T12:00:00Z"))).toEqual({ committedHeight: 100, lagBlocks: 0, lagSeconds: 0 });
  });

  describe("registerSyncLagGauges", () => {
    it("observes the committed height, the block lag and the lag in seconds", () => {
      const { meter, observe } = setup({ committedHeight: 100, lagBlocks: 5, lagSeconds: 30 });

      expect(observe("indexer_sync_height")).toEqual([100]);
      expect(observe("indexer_sync_lag_blocks")).toEqual([5]);
      expect(observe("indexer_sync_lag_seconds")).toEqual([30]);
      expect(meter.createObservableGauge).toHaveBeenCalledWith("indexer_sync_lag_seconds", expect.objectContaining({ unit: "s" }));
    });

    it("observes nothing before the first commit", () => {
      const { observe } = setup(undefined);

      expect(observe("indexer_sync_height")).toEqual([]);
      expect(observe("indexer_sync_lag_blocks")).toEqual([]);
      expect(observe("indexer_sync_lag_seconds")).toEqual([]);
    });

    it("skips the block lag while the tip is unknown", () => {
      const { observe } = setup({ committedHeight: 100, lagBlocks: undefined, lagSeconds: 6 });

      expect(observe("indexer_sync_lag_blocks")).toEqual([]);
      expect(observe("indexer_sync_lag_seconds")).toEqual([6]);
    });
  });

  function setup(current: ReturnType<SyncLagMetrics["read"]>) {
    const callbacks = new Map<string, ObservableCallback>();
    const meter = mock<Meter>();
    meter.createObservableGauge.mockImplementation(name => {
      const gauge = mock<ObservableGauge>();
      gauge.addCallback.mockImplementation(callback => {
        callbacks.set(name, callback);
      });
      return gauge;
    });
    registerSyncLagGauges(meter, () => current);

    const observe = (name: string) => {
      const observed: number[] = [];
      const result = mock<ObservableResult>();
      result.observe.mockImplementation(value => {
        observed.push(value);
      });
      void callbacks.get(name)?.(result);
      return observed;
    };
    return { meter, observe };
  }
});

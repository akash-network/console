import type { Counter } from "@opentelemetry/api";
import { getHeapStatistics } from "node:v8";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { MetricsService } from "@src/core/services/metrics/metrics.service";
import { CachePressureMonitorService } from "./cache-pressure-monitor.service";
import type { RegisterableCache } from "./cache-registry";
import { CacheRegistry } from "./cache-registry";

vi.mock("node:v8", () => ({
  getHeapStatistics: vi.fn()
}));

describe(CachePressureMonitorService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkPressure", () => {
    it("flushes the registered caches once heap usage crosses the threshold", () => {
      const { service, cache, counter, logger } = setup({ heapUsageRatio: 0.9 });

      service.checkPressure();

      expect(cache.clear).toHaveBeenCalledTimes(1);
      expect(counter.add).toHaveBeenCalledWith(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "MEMORY_CACHE_PRESSURE_FLUSH", flushedCaches: ["test-cache"] }));
    });

    it("does nothing below the threshold", () => {
      const { service, cache, counter, logger } = setup({ heapUsageRatio: 0.5 });

      service.checkPressure();

      expect(cache.clear).not.toHaveBeenCalled();
      expect(counter.add).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("does not flush again during the cooldown", () => {
      const { service, counter } = setup({ heapUsageRatio: 0.9 });

      service.checkPressure();
      vi.advanceTimersByTime(30_000);
      service.checkPressure();

      expect(counter.add).toHaveBeenCalledTimes(1);
    });

    it("flushes again once the cooldown has elapsed", () => {
      const { service, counter } = setup({ heapUsageRatio: 0.9 });

      service.checkPressure();
      vi.advanceTimersByTime(5 * 60_000);
      service.checkPressure();

      expect(counter.add).toHaveBeenCalledTimes(2);
    });
  });

  describe("start", () => {
    it("checks heap pressure on an interval until disposed", () => {
      const { service } = setup({ heapUsageRatio: 0.5 });

      service.start();
      vi.advanceTimersByTime(60_000);

      expect(getHeapStatistics).toHaveBeenCalledTimes(2);

      service.dispose();
      vi.advanceTimersByTime(60_000);

      expect(getHeapStatistics).toHaveBeenCalledTimes(2);
    });
  });

  function setup(input: { heapUsageRatio: number }) {
    vi.useFakeTimers();
    vi.mocked(getHeapStatistics).mockClear();
    vi.mocked(getHeapStatistics).mockReturnValue(
      mock<ReturnType<typeof getHeapStatistics>>({
        used_heap_size: input.heapUsageRatio * 1000,
        heap_size_limit: 1000
      })
    );

    const counter = mock<Counter>();
    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockReturnValue(counter);

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const registry = new CacheRegistry();
    const cache = mock<RegisterableCache>({ size: 10, calculatedSize: 100, max: 100, maxSize: 1000 });
    registry.register("test-cache", cache);

    const service = new CachePressureMonitorService(metricsService, createLogger, registry);

    return { service, cache, counter, logger, registry };
  }
});

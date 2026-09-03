import type { ObservableGauge, ObservableResult } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core/services/metrics/metrics.service";
import { CacheInstrumentationService } from "./cache-instrumentation.service";
import type { RegisterableCache } from "./cache-registry";
import { CacheRegistry } from "./cache-registry";

describe(CacheInstrumentationService.name, () => {
  it("observes the entry count of every registered cache", () => {
    const { gauges } = setup({ size: 7, calculatedSize: 700 });
    const result = mock<ObservableResult>();

    gauges.memory_cache_entries.callback(result);

    expect(result.observe).toHaveBeenCalledWith(7, { cache: "test-cache" });
  });

  it("observes the tracked bytes of every registered cache", () => {
    const { gauges } = setup({ size: 7, calculatedSize: 700 });
    const result = mock<ObservableResult>();

    gauges.memory_cache_size_bytes.callback(result);

    expect(result.observe).toHaveBeenCalledWith(700, { cache: "test-cache" });
  });

  function setup(input: { size: number; calculatedSize: number }) {
    const metricsService = mock<MetricsService>();
    const gauges: Record<string, { callback: (result: ObservableResult) => void }> = {};
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createObservableGauge.mockImplementation((_meter, name) =>
      mock<ObservableGauge>({
        addCallback: callback => {
          gauges[name] = { callback };
        }
      })
    );

    const registry = new CacheRegistry();
    registry.register("test-cache", mock<RegisterableCache>({ size: input.size, calculatedSize: input.calculatedSize, max: 100, maxSize: 1000 }));

    const service = new CacheInstrumentationService(metricsService, registry);

    return { service, gauges, registry };
  }
});

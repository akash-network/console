import { singleton } from "tsyringe";

import { MetricsService } from "@src/core/services/metrics/metrics.service";
import { CacheRegistry } from "./cache-registry";

@singleton()
export class CacheInstrumentationService {
  constructor(metricsService: MetricsService, registry: CacheRegistry) {
    const meter = metricsService.getMeter("memory-cache");

    metricsService
      .createObservableGauge(meter, "memory_cache_entries", {
        description: "Entries currently held by each registered in-memory cache"
      })
      .addCallback(result => {
        for (const stats of registry.getStats()) {
          result.observe(stats.entryCount, { cache: stats.name });
        }
      });

    metricsService
      .createObservableGauge(meter, "memory_cache_size_bytes", {
        description: "Tracked bytes currently held by each registered in-memory cache (explicitly sized entries plus a nominal charge per object entry)",
        unit: "By"
      })
      .addCallback(result => {
        for (const stats of registry.getStats()) {
          result.observe(stats.calculatedSizeBytes, { cache: stats.name });
        }
      });
  }
}

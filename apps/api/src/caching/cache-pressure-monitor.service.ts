import type { Counter } from "@opentelemetry/api";
import { getHeapStatistics } from "node:v8";
import { inject, singleton } from "tsyringe";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { MetricsService } from "@src/core/services/metrics/metrics.service";
import { CacheRegistry } from "./cache-registry";

/** Flushing at 85% of the V8 heap limit leaves headroom for in-flight requests to allocate while the flushed entries are collected. */
const HEAP_USAGE_FLUSH_THRESHOLD = 0.85;
const CHECK_INTERVAL_MS = 30_000;
/** Gives the heap time to settle after a flush, so a slowly draining heap does not empty every cache on each check. */
const FLUSH_COOLDOWN_MS = 5 * 60_000;

@singleton()
export class CachePressureMonitorService {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #pressureFlushes: Counter;
  #interval: NodeJS.Timeout | undefined;
  #lastFlushAt = 0;

  constructor(
    metricsService: MetricsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly registry: CacheRegistry
  ) {
    this.#logger = createLogger({ context: CachePressureMonitorService.name });
    this.#pressureFlushes = metricsService.createCounter(metricsService.getMeter("memory-cache"), "memory_cache_pressure_flush_total", {
      description: "Times the registered in-memory caches were flushed because heap usage crossed the pressure threshold"
    });
  }

  start(): void {
    this.#interval ??= setInterval(() => this.checkPressure(), CHECK_INTERVAL_MS);
    this.#interval.unref();
  }

  checkPressure(): void {
    const { used_heap_size, heap_size_limit } = getHeapStatistics();
    const heapUsageRatio = used_heap_size / heap_size_limit;
    if (heapUsageRatio < HEAP_USAGE_FLUSH_THRESHOLD) return;
    if (Date.now() - this.#lastFlushAt < FLUSH_COOLDOWN_MS) return;

    this.#lastFlushAt = Date.now();
    const cachesBeforeFlush = this.registry.getStats();
    const flushedCaches = this.registry.flushLargestCaches();
    this.#pressureFlushes.add(1);
    this.#logger.warn({
      event: "MEMORY_CACHE_PRESSURE_FLUSH",
      heapUsageRatio,
      usedHeapSize: used_heap_size,
      heapSizeLimit: heap_size_limit,
      caches: cachesBeforeFlush,
      flushedCaches: flushedCaches.map(stats => stats.name)
    });
  }

  dispose(): void {
    clearInterval(this.#interval);
    this.#interval = undefined;
  }
}

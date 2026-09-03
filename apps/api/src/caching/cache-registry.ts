export interface RegisterableCache {
  readonly size: number;
  readonly calculatedSize: number;
  readonly max: number;
  readonly maxSize: number;
  clear(): void;
}

export interface CacheStats {
  name: string;
  entryCount: number;
  maxEntries: number;
  calculatedSizeBytes: number;
  maxTotalBytes: number;
}

export class CacheRegistry {
  readonly #caches = new Map<string, RegisterableCache>();

  register(name: string, cache: RegisterableCache): string {
    let uniqueName = name;
    for (let suffix = 2; this.#caches.has(uniqueName); suffix++) {
      uniqueName = `${name}#${suffix}`;
    }
    this.#caches.set(uniqueName, cache);
    return uniqueName;
  }

  getStats(): CacheStats[] {
    return [...this.#caches.entries()].map(([name, cache]) => ({
      name,
      entryCount: cache.size,
      maxEntries: cache.max,
      calculatedSizeBytes: cache.calculatedSize,
      maxTotalBytes: cache.maxSize
    }));
  }

  clearAll(): void {
    for (const cache of this.#caches.values()) {
      cache.clear();
    }
  }

  flushLargestCaches(): CacheStats[] {
    const statsBySizeDescending = this.getStats().sort((a, b) => b.calculatedSizeBytes - a.calculatedSizeBytes || b.entryCount - a.entryCount);
    const totalEntries = statsBySizeDescending.reduce((sum, stats) => sum + stats.entryCount, 0);
    const flushed: CacheStats[] = [];
    let flushedEntries = 0;

    for (const stats of statsBySizeDescending) {
      if (flushedEntries * 2 >= totalEntries) break;
      this.#caches.get(stats.name)?.clear();
      flushed.push(stats);
      flushedEntries += stats.entryCount;
    }

    return flushed;
  }
}

/** Every in-memory cache in the process registers here, so memory incidents can be attributed to a named cache instead of a heap snapshot. */
export const cacheRegistry = new CacheRegistry();

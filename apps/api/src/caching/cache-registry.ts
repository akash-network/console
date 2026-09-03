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

/** Charged to entries stored without an explicit size: object graphs are bounded by entry count and the pressure flush, never serialized to be measured. */
export const NOMINAL_ENTRY_BYTES = 1024;

/** lru-cache tracks `calculatedSize` only when a byte ceiling is set, so object caches declare a flat per-entry charge mirroring their entry limit. */
export function nominalEntrySizing(maxEntries: number, bytesPerEntry: number = NOMINAL_ENTRY_BYTES) {
  return { maxSize: maxEntries * bytesPerEntry, sizeCalculation: () => bytesPerEntry };
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
    const totalBytes = statsBySizeDescending.reduce((sum, stats) => sum + stats.calculatedSizeBytes, 0);
    const flushed: CacheStats[] = [];
    let flushedBytes = 0;

    for (const stats of statsBySizeDescending) {
      if (flushedBytes * 2 >= totalBytes) break;
      this.#caches.get(stats.name)?.clear();
      flushed.push(stats);
      flushedBytes += stats.calculatedSizeBytes;
    }

    return flushed;
  }
}

/** Every in-memory cache in the process registers here, so memory incidents can be attributed to a named cache instead of a heap snapshot. */
export const cacheRegistry = new CacheRegistry();

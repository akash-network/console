import { LRUCache } from "lru-cache";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RegisterableCache } from "./cache-registry";
import { CacheRegistry, nominalEntrySizing } from "./cache-registry";

describe(CacheRegistry.name, () => {
  describe("register", () => {
    it("returns the given name when it is not taken", () => {
      const { registry } = setup();

      expect(registry.register("shared", buildCache())).toBe("shared");
    });

    it("suffixes duplicate names instead of overwriting the existing cache", () => {
      const { registry } = setup();
      registry.register("private", buildCache());

      expect(registry.register("private", buildCache())).toBe("private#2");
      expect(registry.register("private", buildCache())).toBe("private#3");
      expect(registry.getStats().map(stats => stats.name)).toEqual(["private", "private#2", "private#3"]);
    });
  });

  describe("getStats", () => {
    it("reports each registered cache with its counts and byte accounting", () => {
      const { registry } = setup();
      registry.register("bounded", buildCache({ size: 3, calculatedSize: 300, max: 10, maxSize: 1000 }));

      expect(registry.getStats()).toEqual([{ name: "bounded", entryCount: 3, maxEntries: 10, calculatedSizeBytes: 300, maxTotalBytes: 1000 }]);
    });
  });

  describe("clearAll", () => {
    it("clears every registered cache", () => {
      const { registry } = setup();
      const first = buildCache();
      const second = buildCache();
      registry.register("first", first);
      registry.register("second", second);

      registry.clearAll();

      expect(first.clear).toHaveBeenCalledTimes(1);
      expect(second.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe("flushLargestCaches", () => {
    it("clears the largest caches first until at least half of the tracked bytes are released", () => {
      const { registry } = setup();
      const small = buildCache({ size: 10, calculatedSize: 100 });
      const medium = buildCache({ size: 20, calculatedSize: 5000 });
      const large = buildCache({ size: 30, calculatedSize: 9000 });
      registry.register("small", small);
      registry.register("medium", medium);
      registry.register("large", large);

      const flushed = registry.flushLargestCaches();

      expect(flushed.map(stats => stats.name)).toEqual(["large"]);
      expect(large.clear).toHaveBeenCalledTimes(1);
      expect(medium.clear).not.toHaveBeenCalled();
      expect(small.clear).not.toHaveBeenCalled();
    });

    it("spares a cache of many small entries once a single large one releases half of the tracked bytes", () => {
      const { registry } = setup();
      const manySmallEntries = buildCache({ size: 100, calculatedSize: 100 * 1024 });
      const oneLargeEntry = buildCache({ size: 1, calculatedSize: 100 * 1024 * 1024 });
      registry.register("manySmallEntries", manySmallEntries);
      registry.register("oneLargeEntry", oneLargeEntry);

      const flushed = registry.flushLargestCaches();

      expect(flushed.map(stats => stats.name)).toEqual(["oneLargeEntry"]);
      expect(oneLargeEntry.clear).toHaveBeenCalledTimes(1);
      expect(manySmallEntries.clear).not.toHaveBeenCalled();
    });

    it("keeps flushing when the largest cache alone holds less than half of the tracked bytes", () => {
      const { registry } = setup();
      const small = buildCache({ size: 40, calculatedSize: 2500 });
      const medium = buildCache({ size: 20, calculatedSize: 3500 });
      const large = buildCache({ size: 10, calculatedSize: 4000 });
      registry.register("small", small);
      registry.register("medium", medium);
      registry.register("large", large);

      const flushed = registry.flushLargestCaches();

      expect(flushed.map(stats => stats.name)).toEqual(["large", "medium"]);
      expect(large.clear).toHaveBeenCalledTimes(1);
      expect(medium.clear).toHaveBeenCalledTimes(1);
      expect(small.clear).not.toHaveBeenCalled();
    });

    it("breaks size ties by entry count", () => {
      const { registry } = setup();
      const fewEntries = buildCache({ size: 5, calculatedSize: 1000 });
      const manyEntries = buildCache({ size: 50, calculatedSize: 1000 });
      registry.register("fewEntries", fewEntries);
      registry.register("manyEntries", manyEntries);

      const flushed = registry.flushLargestCaches();

      expect(flushed.map(stats => stats.name)).toEqual(["manyEntries"]);
    });

    it("flushes nothing when every cache is empty", () => {
      const { registry } = setup();
      const empty = buildCache({ size: 0 });
      registry.register("empty", empty);

      expect(registry.flushLargestCaches()).toEqual([]);
      expect(empty.clear).not.toHaveBeenCalled();
    });
  });

  describe("nominalEntrySizing", () => {
    it("makes an lru cache of object values report its entries as bytes", () => {
      const { registry } = setup();
      const cache = new LRUCache<string, object>({ max: 10, ...nominalEntrySizing(10, 512) });
      cache.set("first", {});
      cache.set("second", {});
      registry.register("objects", cache);

      expect(registry.getStats()).toEqual([{ name: "objects", entryCount: 2, maxEntries: 10, calculatedSizeBytes: 1024, maxTotalBytes: 5120 }]);
    });

    it("leaves the entry limit as the only bound that evicts", () => {
      const cache = new LRUCache<string, object>({ max: 3, ...nominalEntrySizing(3, 512) });

      for (const key of ["first", "second", "third"]) cache.set(key, {});

      expect(cache.size).toBe(3);
      expect(cache.calculatedSize).toBe(cache.maxSize);
    });
  });

  function buildCache(overrides?: Partial<Pick<RegisterableCache, "size" | "calculatedSize" | "max" | "maxSize">>) {
    return mock<RegisterableCache>({ size: 0, calculatedSize: 0, max: 0, maxSize: 0, ...overrides });
  }

  function setup() {
    return { registry: new CacheRegistry() };
  }
});

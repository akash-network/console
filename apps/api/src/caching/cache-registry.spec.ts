import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RegisterableCache } from "./cache-registry";
import { CacheRegistry } from "./cache-registry";

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
    it("clears the largest caches first until at least half of all entries are flushed", () => {
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

    it("keeps flushing when the largest cache alone holds less than half of all entries", () => {
      const { registry } = setup();
      const small = buildCache({ size: 40, calculatedSize: 100 });
      const large = buildCache({ size: 10, calculatedSize: 9000 });
      registry.register("small", small);
      registry.register("large", large);

      const flushed = registry.flushLargestCaches();

      expect(flushed.map(stats => stats.name)).toEqual(["large", "small"]);
      expect(large.clear).toHaveBeenCalledTimes(1);
      expect(small.clear).toHaveBeenCalledTimes(1);
    });

    it("breaks size ties by entry count", () => {
      const { registry } = setup();
      const fewEntries = buildCache({ size: 5, calculatedSize: 0 });
      const manyEntries = buildCache({ size: 50, calculatedSize: 0 });
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

  function buildCache(overrides?: Partial<Pick<RegisterableCache, "size" | "calculatedSize" | "max" | "maxSize">>) {
    return mock<RegisterableCache>({ size: 0, calculatedSize: 0, max: 0, maxSize: 0, ...overrides });
  }

  function setup() {
    return { registry: new CacheRegistry() };
  }
});

import { describe, expect, it } from "vitest";

import MemoryCacheEngine, { estimateEntryBytes } from "./memoryCacheEngine";

describe(MemoryCacheEngine.name, () => {
  describe("getFromCache", () => {
    it("returns stored value", () => {
      const { engine } = setup();

      engine.storeInCache("key", "value");

      expect(engine.getFromCache("key")).toBe("value");
    });

    it("returns undefined for missing key", () => {
      const { engine } = setup();

      expect(engine.getFromCache("missing")).toBeUndefined();
    });

    it("returns object values", () => {
      const { engine } = setup();

      const data = { nested: { deep: true } };
      engine.storeInCache("obj", data);

      expect(engine.getFromCache("obj")).toEqual(data);
    });
  });

  describe("storeInCache", () => {
    it("stores and retrieves a value", () => {
      const { engine } = setup();

      engine.storeInCache("key", 42);

      expect(engine.getFromCache("key")).toBe(42);
    });

    it("overwrites existing value", () => {
      const { engine } = setup();

      engine.storeInCache("key", "first");
      engine.storeInCache("key", "second");

      expect(engine.getFromCache("key")).toBe("second");
    });

    it("expires entries after durationInSeconds", async () => {
      const { engine } = setup();

      engine.storeInCache("ttl-key", "ephemeral", 0.05);

      expect(engine.getFromCache("ttl-key")).toBe("ephemeral");

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(engine.getFromCache("ttl-key")).toBeUndefined();
    });

    it("does not expire entries without duration", async () => {
      const { engine } = setup();

      engine.storeInCache("no-ttl", "persistent");

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(engine.getFromCache("no-ttl")).toBe("persistent");
    });
  });

  describe("clearAllKeyInCache", () => {
    it("removes all entries", () => {
      const { engine } = setup();

      engine.storeInCache("a", 1);
      engine.storeInCache("b", 2);
      engine.storeInCache("c", 3);

      engine.clearAllKeyInCache();

      expect(engine.getFromCache("a")).toBeUndefined();
      expect(engine.getFromCache("b")).toBeUndefined();
      expect(engine.getFromCache("c")).toBeUndefined();
      expect(engine.getKeys()).toHaveLength(0);
    });
  });

  describe("clearKeyInCache", () => {
    it("removes a specific key", () => {
      const { engine } = setup();

      engine.storeInCache("keep", "yes");
      engine.storeInCache("remove", "no");

      engine.clearKeyInCache("remove");

      expect(engine.getFromCache("keep")).toBe("yes");
      expect(engine.getFromCache("remove")).toBeUndefined();
    });

    it("does nothing for non-existent key", () => {
      const { engine } = setup();

      engine.storeInCache("exists", "value");
      engine.clearKeyInCache("ghost");

      expect(engine.getFromCache("exists")).toBe("value");
    });
  });

  describe("clearByKey", () => {
    it("delegates to clearKeyInCache", () => {
      const { engine } = setup();

      engine.storeInCache("target", "value");
      engine.clearByKey("target");

      expect(engine.getFromCache("target")).toBeUndefined();
    });
  });

  describe("clearByPrefix", () => {
    it("removes all keys matching the prefix", () => {
      const { engine } = setup();

      engine.storeInCache("prefix:a", 1);
      engine.storeInCache("prefix:b", 2);
      engine.storeInCache("other:c", 3);

      engine.clearByPrefix("prefix:");

      expect(engine.getFromCache("prefix:a")).toBeUndefined();
      expect(engine.getFromCache("prefix:b")).toBeUndefined();
      expect(engine.getFromCache("other:c")).toBe(3);
    });

    it("does nothing when no keys match", () => {
      const { engine } = setup();

      engine.storeInCache("key1", "val1");

      engine.clearByPrefix("nomatch:");

      expect(engine.getFromCache("key1")).toBe("val1");
    });
  });

  describe("getKeys", () => {
    it("returns all stored keys", () => {
      const { engine } = setup();

      engine.storeInCache("x", 1);
      engine.storeInCache("y", 2);
      engine.storeInCache("z", 3);

      const keys = engine.getKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("x");
      expect(keys).toContain("y");
      expect(keys).toContain("z");
    });

    it("returns empty array when cache is empty", () => {
      const { engine } = setup();

      expect(engine.getKeys()).toEqual([]);
    });
  });

  describe("when constructed with maxEntries", () => {
    it("does not share entries with the shared cache", () => {
      const { engine } = setup();
      const privateEngine = new MemoryCacheEngine({ maxEntries: 2 });

      engine.storeInCache("shared", 1);
      privateEngine.storeInCache("private", 2);

      expect(privateEngine.getFromCache("shared")).toBeUndefined();
      expect(engine.getFromCache("private")).toBeUndefined();
    });

    it("evicts the least recently used entry once maxEntries is exceeded", () => {
      const privateEngine = new MemoryCacheEngine({ maxEntries: 2 });

      privateEngine.storeInCache("a", 1);
      privateEngine.storeInCache("b", 2);
      privateEngine.storeInCache("c", 3);

      expect(privateEngine.getFromCache("a")).toBeUndefined();
      expect(privateEngine.getKeys()).toHaveLength(2);
      expect(privateEngine.getKeys()).toContain("b");
      expect(privateEngine.getKeys()).toContain("c");
    });

    it("is not emptied by clearAllKeyInCache on the shared engine", () => {
      const { engine } = setup();
      const privateEngine = new MemoryCacheEngine({ maxEntries: 2 });
      privateEngine.storeInCache("private", 1);

      engine.clearAllKeyInCache();

      expect(privateEngine.getFromCache("private")).toBe(1);
    });
  });

  describe("clearAllCaches", () => {
    it("empties private caches alongside the shared one", () => {
      const { engine } = setup();
      const privateEngine = new MemoryCacheEngine({ maxEntries: 2 });
      engine.storeInCache("shared", 1);
      privateEngine.storeInCache("private", 2);

      MemoryCacheEngine.clearAllCaches();

      expect(engine.getFromCache("shared")).toBeUndefined();
      expect(privateEngine.getFromCache("private")).toBeUndefined();
    });
  });

  describe("size bounding", () => {
    it("evicts least-recently-used entries when total bytes exceed maxTotalBytes", () => {
      const engine = new MemoryCacheEngine({ maxTotalBytes: 250, maxEntryBytes: 250 });

      engine.storeInCache("first", "x".repeat(100));
      engine.storeInCache("second", "y".repeat(100));
      engine.storeInCache("third", "z".repeat(100));

      expect(engine.getFromCache("first")).toBeUndefined();
      expect(engine.getFromCache("second")).toBe("y".repeat(100));
      expect(engine.getFromCache("third")).toBe("z".repeat(100));
    });

    it("refuses a single entry larger than maxEntryBytes without evicting others", () => {
      const engine = new MemoryCacheEngine({ maxTotalBytes: 1000, maxEntryBytes: 100 });

      engine.storeInCache("small", "kept");
      engine.storeInCache("huge", "x".repeat(500));

      expect(engine.getFromCache("huge")).toBeUndefined();
      expect(engine.getFromCache("small")).toBe("kept");
    });

    it("accepts a Buffer entry whose binary length is within maxEntryBytes", () => {
      const engine = new MemoryCacheEngine({ maxTotalBytes: 8000, maxEntryBytes: 1500 });

      engine.storeInCache("binary", { payload: Buffer.alloc(1024) });

      expect(engine.getFromCache("binary")).toEqual({ payload: Buffer.alloc(1024) });
    });

    it("refuses a multi-byte string whose UTF-8 size exceeds maxEntryBytes", () => {
      const engine = new MemoryCacheEngine({ maxTotalBytes: 8000, maxEntryBytes: 2000 });

      engine.storeInCache("multibyte", { text: "\u20ac".repeat(1000) });

      expect(engine.getFromCache("multibyte")).toBeUndefined();
    });

    it("stores entries within both budgets", () => {
      const engine = new MemoryCacheEngine({ maxTotalBytes: 1000, maxEntryBytes: 500 });

      engine.storeInCache("fits", { data: "payload" });

      expect(engine.getFromCache("fits")).toEqual({ data: "payload" });
    });
  });

  describe(estimateEntryBytes.name, () => {
    it("measures plain values by their JSON length", () => {
      expect(estimateEntryBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length + 1);
    });

    it("counts binary payloads by byte length instead of JSON-inflating them", () => {
      const size = estimateEntryBytes({ data: new Uint8Array(1000) });

      expect(size).toBeGreaterThanOrEqual(1000);
      expect(size).toBeLessThan(2000);
    });

    it("counts Buffer payloads by binary length rather than their JSON expansion", () => {
      const size = estimateEntryBytes({ data: Buffer.alloc(1000) });

      expect(size).toBeGreaterThanOrEqual(1000);
      expect(size).toBeLessThan(2000);
    });

    it("measures multi-byte characters as UTF-8 bytes rather than UTF-16 code units", () => {
      const text = "\u20ac".repeat(1000);

      expect(estimateEntryBytes({ text })).toBeGreaterThan(3000);
    });

    it("serializes bigint values instead of throwing", () => {
      expect(estimateEntryBytes({ amount: 10n })).toBeGreaterThan(0);
    });

    it("returns an uncacheable size for circular values", () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;

      expect(estimateEntryBytes(circular)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  function setup() {
    const engine = new MemoryCacheEngine();
    engine.clearAllKeyInCache();
    return { engine };
  }
});

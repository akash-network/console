import { describe, expect, it, vi } from "vitest";

import { VisitorReadCache } from "./visitor-read-cache";

describe(VisitorReadCache.name, () => {
  it("reads once and serves the same answer until it expires", async () => {
    const { cache, clock } = setup({ ttlMs: 1_000 });
    const load = vi.fn(async () => "first");

    expect(await cache.read("tpl-1", load)).toBe("first");
    clock.now = 999;
    expect(await cache.read("tpl-1", load)).toBe("first");

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads again once the answer has expired", async () => {
    const { cache, clock } = setup({ ttlMs: 1_000 });
    await cache.read("tpl-1", async () => "first");

    clock.now = 1_000;

    expect(await cache.read("tpl-1", async () => "second")).toBe("second");
  });

  it("shares one read between callers that ask while it is under way", async () => {
    const { cache } = setup({});
    let answer: (value: string) => void = () => {};
    const load = vi.fn(() => new Promise<string>(resolve => (answer = resolve)));

    const reads = [cache.read("tpl-1", load), cache.read("tpl-1", load)];
    answer("shared");

    expect(await Promise.all(reads)).toEqual(["shared", "shared"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps the answers of different keys apart", async () => {
    const { cache } = setup({});

    await cache.read("tpl-1", async () => "one");

    expect(await cache.read("tpl-2", async () => "two")).toBe("two");
    expect(await cache.read("tpl-1", async () => "never read")).toBe("one");
  });

  it("forgets a failed read, so the next caller reads again", async () => {
    const { cache } = setup({});

    await expect(cache.read("tpl-1", async () => Promise.reject(new Error("api down")))).rejects.toThrow("api down");

    expect(await cache.read("tpl-1", async () => "recovered")).toBe("recovered");
  });

  it("keeps a newer read when an older one of the same key fails after it", async () => {
    const { cache, clock } = setup({ ttlMs: 1_000 });
    let failOlder: (error: Error) => void = () => {};
    const older = cache.read("tpl-1", () => new Promise<string>((_, reject) => (failOlder = reject)));
    clock.now = 1_000;
    await cache.read("tpl-1", async () => "newer");

    failOlder(new Error("late failure"));
    await expect(older).rejects.toThrow("late failure");

    expect(await cache.read("tpl-1", async () => "never read")).toBe("newer");
  });

  it("drops the oldest answers beyond its size", async () => {
    const { cache } = setup({ maxEntries: 2 });
    await cache.read("tpl-1", async () => "one");
    await cache.read("tpl-2", async () => "two");

    await cache.read("tpl-3", async () => "three");

    expect(await cache.read("tpl-2", async () => "never read")).toBe("two");
    expect(await cache.read("tpl-3", async () => "never read")).toBe("three");
    expect(await cache.read("tpl-1", async () => "read again")).toBe("read again");
  });

  it("counts a refreshed key as the newest", async () => {
    const { cache, clock } = setup({ ttlMs: 1_000, maxEntries: 2 });
    await cache.read("tpl-1", async () => "one");
    await cache.read("tpl-2", async () => "two");
    clock.now = 1_000;
    await cache.read("tpl-1", async () => "one again");

    await cache.read("tpl-3", async () => "three");

    expect(await cache.read("tpl-1", async () => "never read")).toBe("one again");
  });

  it("uses the wall clock unless told otherwise", async () => {
    const cache = new VisitorReadCache<string>({ ttlMs: 60_000, maxEntries: 1 });
    const load = vi.fn(async () => "kept");

    await cache.read("tpl-1", load);
    await cache.read("tpl-1", load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  function setup(input: { ttlMs?: number; maxEntries?: number }) {
    const clock = { now: 0 };
    const cache = new VisitorReadCache<string>({ ttlMs: input.ttlMs ?? 60_000, maxEntries: input.maxEntries ?? 10, now: () => clock.now });

    return { cache, clock };
  }
});

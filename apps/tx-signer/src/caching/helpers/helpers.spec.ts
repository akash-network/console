import { describe, expect, it, vi } from "vitest";

import { memoizeAsync } from "./helpers";

describe(memoizeAsync.name, () => {
  it("memoizes successful results", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const memoized = memoizeAsync(fn);

    const result1 = await memoized();
    const result2 = await memoized();

    expect(result1).toBe("result");
    expect(result2).toBe("result");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not cache rejected promises", async () => {
    const error = new Error("Test error");
    const fn = vi.fn().mockRejectedValue(error);
    const memoized = memoizeAsync(fn);

    await expect(memoized()).rejects.toThrow("Test error");
    await expect(memoized()).rejects.toThrow("Test error");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("remembers one result per set of arguments", async () => {
    const fn = vi.fn(async (value: number) => value * 2);
    const memoized = memoizeAsync(fn);

    await expect(memoized(1)).resolves.toBe(2);
    await expect(memoized(2)).resolves.toBe(4);
    await expect(memoized(1)).resolves.toBe(2);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("forgets the oldest result once it holds as many as it may", async () => {
    const fn = vi.fn(async (value: number) => value);
    const memoized = memoizeAsync(fn, { maxEntries: 2 });

    await memoized(1);
    await memoized(2);
    await memoized(3);
    fn.mockClear();

    await memoized(2);
    await memoized(3);
    expect(fn).not.toHaveBeenCalled();

    await memoized(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("keeps every result while it holds fewer than it may", async () => {
    const fn = vi.fn(async (value: number) => value);
    const memoized = memoizeAsync(fn, { maxEntries: 2 });

    await memoized(1);
    await memoized(2);
    await memoized(1);
    await memoized(2);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

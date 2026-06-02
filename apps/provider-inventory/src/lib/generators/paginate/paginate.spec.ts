import { describe, expect, it, vi } from "vitest";

import { paginate } from "./paginate";

describe("paginate", () => {
  it("fetches a single page when the first response has no nextKey", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({ items: [1, 2, 3], nextKey: undefined });

    const pages = await Array.fromAsync(paginate(fetchPage));

    expect(pages).toEqual([[1, 2, 3]]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it("stops when an empty Uint8Array nextKey is returned", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({ items: ["a"], nextKey: new Uint8Array(0) });

    const pages = await Array.fromAsync(paginate(fetchPage));

    expect(pages).toEqual([["a"]]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("follows nextKey across pages, passing the previous key into the next fetch", async () => {
    const pageOneKey = new Uint8Array([1, 2, 3]);
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], nextKey: pageOneKey })
      .mockResolvedValueOnce({ items: [2], nextKey: new Uint8Array(0) });

    const pages = await Array.fromAsync(paginate(fetchPage));

    expect(pages).toEqual([[1], [2]]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, pageOneKey);
  });

  it("stops fetching further pages once the signal is aborted", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn().mockImplementation(async () => {
      controller.abort();
      return { items: [1], nextKey: new Uint8Array([9]) };
    });

    const pages = await Array.fromAsync(paginate(fetchPage, { signal: controller.signal }));

    expect(pages).toEqual([[1]]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from "vitest";

import { getBlockDownloadRange, MAX_DOWNLOAD_GROUP_SIZE } from "./blockDownloadRange";

describe(getBlockDownloadRange.name, () => {
  it("downloads from the first height the database lacks up to the latest block", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 100, latestBlockToDownload: 105 }))).toEqual({ startHeight: 101, endHeight: 105 });
  });

  it("still downloads a gap the database lacks when the cache already reaches the latest block", () => {
    const range = getBlockDownloadRange(input({ latestInsertedHeight: 29510202, latestHeightInCache: 29510205, latestBlockToDownload: 29510205 }));

    expect(range).toEqual({ startHeight: 29510203, endHeight: 29510205 });
  });

  it("returns nothing when the database already holds the latest block", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 105, latestBlockToDownload: 105 }))).toBeNull();
  });

  it("downloads the latest block alone when the database is one block behind", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 104, latestBlockToDownload: 105 }))).toEqual({ startHeight: 105, endHeight: 105 });
  });

  it("limits a download to the maximum group size past its start", () => {
    const range = getBlockDownloadRange(input({ latestInsertedHeight: 100, latestBlockToDownload: 100 + MAX_DOWNLOAD_GROUP_SIZE + 2 }));

    expect(range).toEqual({ startHeight: 101, endHeight: 101 + MAX_DOWNLOAD_GROUP_SIZE });
  });

  it("downloads up to the latest block when it sits exactly at the maximum group size past the start", () => {
    const range = getBlockDownloadRange(input({ latestInsertedHeight: 100, latestBlockToDownload: 101 + MAX_DOWNLOAD_GROUP_SIZE }));

    expect(range).toEqual({ startHeight: 101, endHeight: 101 + MAX_DOWNLOAD_GROUP_SIZE });
  });

  it("starts from the chain start height when the database is empty", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 0, chainStartHeight: 50, latestBlockToDownload: 60 }))).toEqual({
      startHeight: 50,
      endHeight: 60
    });
  });

  it("starts from the first block when the database is empty and the chain has no start height", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 0, chainStartHeight: undefined, latestBlockToDownload: 10 }))).toEqual({
      startHeight: 1,
      endHeight: 10
    });
  });

  it("restarts from a block reported missing", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 100, missingBlock: 90, latestBlockToDownload: 105 }))).toEqual({
      startHeight: 90,
      endHeight: 105
    });
  });

  it("caps a missing block above the latest block at the latest block", () => {
    expect(getBlockDownloadRange(input({ latestInsertedHeight: 100, missingBlock: 110, latestBlockToDownload: 105 }))).toEqual({
      startHeight: 105,
      endHeight: 105
    });
  });

  describe("when the cache is kept between runs", () => {
    it("downloads from the top of the cache", () => {
      const range = getBlockDownloadRange(input({ keepCache: true, latestInsertedHeight: 50, latestHeightInCache: 100, latestBlockToDownload: 105 }));

      expect(range).toEqual({ startHeight: 100, endHeight: 105 });
    });

    it("starts from the first block when the cache is empty", () => {
      const range = getBlockDownloadRange(input({ keepCache: true, latestInsertedHeight: 50, latestHeightInCache: 0, latestBlockToDownload: 5 }));

      expect(range).toEqual({ startHeight: 1, endHeight: 5 });
    });

    it("returns nothing when the cache is past the latest block", () => {
      expect(getBlockDownloadRange(input({ keepCache: true, latestInsertedHeight: 50, latestHeightInCache: 106, latestBlockToDownload: 105 }))).toBeNull();
    });
  });

  function input(overrides: Partial<Parameters<typeof getBlockDownloadRange>[0]>) {
    return {
      latestInsertedHeight: 0,
      latestHeightInCache: 0,
      latestBlockToDownload: 0,
      missingBlock: null,
      keepCache: false,
      chainStartHeight: undefined,
      ...overrides
    };
  }
});

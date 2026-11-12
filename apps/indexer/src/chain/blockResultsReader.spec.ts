import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockResultType } from "@src/shared/types";
import { createBlockResultsReader } from "./blockResultsReader";

describe(createBlockResultsReader.name, () => {
  it("returns the cached block results without asking a node", async () => {
    const cachedBlockResults = mock<BlockResultType>({ height: "29448411" });
    const { readBlockResults, downloadBlockResults, cacheBlockResults } = setup({ cachedBlockResults });

    await expect(readBlockResults(29448411)).resolves.toBe(cachedBlockResults);
    expect(downloadBlockResults).not.toHaveBeenCalled();
    expect(cacheBlockResults).not.toHaveBeenCalled();
  });

  it("downloads and caches the block results when the cache does not hold them", async () => {
    const downloadedBlockResults = mock<BlockResultType>({ height: "29448411" });
    const { readBlockResults, findCachedBlockResults, downloadBlockResults, cacheBlockResults } = setup({ cachedBlockResults: null, downloadedBlockResults });

    await expect(readBlockResults(29448411)).resolves.toBe(downloadedBlockResults);
    expect(findCachedBlockResults).toHaveBeenCalledWith(29448411);
    expect(downloadBlockResults).toHaveBeenCalledWith(29448411);
    expect(cacheBlockResults).toHaveBeenCalledWith(29448411, downloadedBlockResults);
  });

  function setup(input: { cachedBlockResults: BlockResultType | null; downloadedBlockResults?: BlockResultType }) {
    const findCachedBlockResults = vi.fn().mockResolvedValue(input.cachedBlockResults);
    const downloadBlockResults = vi.fn().mockResolvedValue(input.downloadedBlockResults);
    const cacheBlockResults = vi.fn().mockResolvedValue(undefined);
    const readBlockResults = createBlockResultsReader({ findCachedBlockResults, downloadBlockResults, cacheBlockResults });

    return { readBlockResults, findCachedBlockResults, downloadBlockResults, cacheBlockResults };
  }
});

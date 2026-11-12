import type { BlockResultType } from "@src/shared/types";

export type BlockResultsReader = (height: number) => Promise<BlockResultType>;

type BlockResultsSources = {
  findCachedBlockResults: (height: number) => Promise<BlockResultType | null>;
  downloadBlockResults: (height: number) => Promise<BlockResultType>;
  cacheBlockResults: (height: number, blockResults: BlockResultType) => Promise<void>;
};

export function createBlockResultsReader(sources: BlockResultsSources): BlockResultsReader {
  return async height => {
    const cachedBlockResults = await sources.findCachedBlockResults(height);
    if (cachedBlockResults) return cachedBlockResults;

    const blockResults = await sources.downloadBlockResults(height);
    await sources.cacheBlockResults(height, blockResults);

    return blockResults;
  };
}

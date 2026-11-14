export const MAX_DOWNLOAD_GROUP_SIZE = 1_000;

export interface BlockDownloadRange {
  startHeight: number;
  endHeight: number;
}

/** Starts at the first height the database lacks, not the top of the cache, since a failed run can leave heights cached above a gap. */
export function getBlockDownloadRange(input: {
  latestInsertedHeight: number;
  latestHeightInCache: number;
  latestBlockToDownload: number;
  missingBlock: number | null;
  keepCache: boolean;
  chainStartHeight: number | undefined;
}): BlockDownloadRange | null {
  let startHeight = input.keepCache ? Math.max(input.latestHeightInCache, 1) : input.latestInsertedHeight + 1;

  if (input.latestInsertedHeight === 0) {
    startHeight = input.chainStartHeight || 1;
  }

  if (input.missingBlock) {
    startHeight = Math.min(input.missingBlock, input.latestBlockToDownload);
  }

  if (startHeight > input.latestBlockToDownload) return null;

  return { startHeight, endHeight: Math.min(input.latestBlockToDownload, startHeight + MAX_DOWNLOAD_GROUP_SIZE) };
}

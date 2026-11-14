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
  let startHeight = getFirstHeightToDownload(input);

  if (input.missingBlock) {
    startHeight = Math.min(input.missingBlock, input.latestBlockToDownload);
  }

  if (startHeight > input.latestBlockToDownload) return null;

  return { startHeight, endHeight: Math.min(input.latestBlockToDownload, startHeight + MAX_DOWNLOAD_GROUP_SIZE) };
}

function getFirstHeightToDownload(input: {
  latestInsertedHeight: number;
  latestHeightInCache: number;
  keepCache: boolean;
  chainStartHeight: number | undefined;
}) {
  if (input.keepCache && input.latestHeightInCache > 0) return input.latestHeightInCache + 1;
  if (input.latestInsertedHeight === 0) return input.chainStartHeight || 1;

  return input.keepCache ? 1 : input.latestInsertedHeight + 1;
}

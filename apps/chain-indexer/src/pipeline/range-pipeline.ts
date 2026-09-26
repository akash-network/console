import type { DecodedBlock } from "@src/pipeline/decoded-block";

export interface RangePipelineInput {
  startHeight: number;
  endHeight: number;
  concurrency: number;
  batchSize: number;
  fetch: (height: number) => Promise<DecodedBlock>;
  /** Sees every block in height order before it joins a batch; throwing halts the run before that block commits. */
  inspect?: (block: DecodedBlock) => void;
  /** Commits one contiguous batch; never called while a previous commit is still in flight. */
  commit: (batch: DecodedBlock[]) => Promise<void>;
  isStopped: () => boolean;
}

export interface RangePipelineProgress {
  blocksCommitted: number;
  transactionsCommitted: number;
  lastCommittedHeight: number;
}

/**
 * Two-stage pipeline over a height range: up to `concurrency` blocks are fetched in parallel while
 * heights are consumed strictly in order, and each full batch commits detached so the next batch is
 * assembled while it lands. At most one commit is in flight, since batch N+1's writes depend on
 * batch N being committed. Prefetch and commit promises get a no-op catch at creation: a rejection
 * settling before the loop awaits it would otherwise crash the process as an unhandled rejection;
 * the real rejection still surfaces when the loop awaits it.
 *
 * Progress is tracked by the last committed height rather than the stopped flag, so a shutdown landing
 * during the final commit still reports the range as done instead of failing the Job for a spurious retry.
 */
export async function runRangePipeline(input: RangePipelineInput): Promise<RangePipelineProgress> {
  const inflight = new Map<number, Promise<DecodedBlock>>();
  const progress: RangePipelineProgress = { blocksCommitted: 0, transactionsCommitted: 0, lastCommittedHeight: input.startHeight - 1 };
  let fetchHead = input.startHeight;
  let batch: DecodedBlock[] = [];
  let pendingCommit: Promise<void> | null = null;
  let commitFailed = false;

  const fillFetchWindow = () => {
    while (fetchHead <= input.endHeight && inflight.size < input.concurrency) {
      const height = fetchHead;
      const prefetched = input.fetch(height);
      prefetched.catch(() => undefined);
      inflight.set(height, prefetched);
      fetchHead++;
    }
  };

  const commitDetached = (blocks: DecodedBlock[]) => {
    const commit = input.commit(blocks).then(() => {
      progress.blocksCommitted += blocks.length;
      progress.transactionsCommitted += blocks.reduce((sum, block) => sum + block.transactions.length, 0);
      progress.lastCommittedHeight = blocks[blocks.length - 1].height;
    });
    commit.catch(() => {
      commitFailed = true;
    });
    return commit;
  };

  try {
    for (let height = input.startHeight; height <= input.endHeight && !input.isStopped() && !commitFailed; height++) {
      fillFetchWindow();
      const decoded = await inflight.get(height)!;
      inflight.delete(height);

      input.inspect?.(decoded);
      batch.push(decoded);
      fillFetchWindow();

      if (batch.length >= input.batchSize || height === input.endHeight) {
        if (pendingCommit) {
          await pendingCommit;
        }
        pendingCommit = commitDetached(batch);
        batch = [];
      }
    }

    if (pendingCommit) {
      await pendingCommit;
    }
  } catch (error) {
    throw await preferCommitFailure(error, pendingCommit);
  } finally {
    await Promise.allSettled([...inflight.values(), pendingCommit]);
  }

  return progress;
}

/** A detached commit still rejecting when a later step throws is the real cause, so it wins over the error that merely followed it. */
async function preferCommitFailure(error: unknown, pendingCommit: Promise<void> | null): Promise<unknown> {
  if (!pendingCommit) {
    return error;
  }
  const [commit] = await Promise.allSettled([pendingCommit]);
  return commit.status === "rejected" ? commit.reason : error;
}

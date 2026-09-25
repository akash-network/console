import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";

import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { runRangePipeline } from "@src/pipeline/range-pipeline";

describe(runRangePipeline.name, () => {
  it("commits contiguous batches in ascending order even when fetches resolve out of order", async () => {
    const { run, committed } = setup({ startHeight: 1, endHeight: 5, batchSize: 2, concurrency: 5, fetchDelayMs: height => (6 - height) * 5 });

    const progress = await run();

    expect(committed()).toEqual([[1, 2], [3, 4], [5]]);
    expect(progress).toEqual({ blocksCommitted: 5, transactionsCommitted: 5, lastCommittedHeight: 5 });
  });

  it("never fetches more blocks in parallel than the configured concurrency", async () => {
    const { run, maxObservedConcurrency } = setup({ startHeight: 1, endHeight: 10, batchSize: 10, concurrency: 3, fetchDelayMs: () => 2 });

    await run();

    expect(maxObservedConcurrency()).toBeLessThanOrEqual(3);
  });

  it("assembles the next batch while the previous batch is still committing", async () => {
    const { run, fetched, commits } = setup({ startHeight: 1, endHeight: 8, batchSize: 4, concurrency: 2 });
    let releaseFirstCommit!: () => void;
    commits.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releaseFirstCommit = resolve;
        })
    );

    const running = run();
    await vi.waitFor(() => expect(fetched()).toContain(8));

    expect(commits).toHaveBeenCalledTimes(1);
    releaseFirstCommit();
    await running;
    expect(commits).toHaveBeenCalledTimes(2);
  });

  it("rejects with the commit failure and stops fetching further batches", async () => {
    const { run, fetched, commits } = setup({ startHeight: 1, endHeight: 12, batchSize: 4, concurrency: 2 });
    commits.mockImplementation(async blocks => {
      if (blocks[0].height === 1) {
        throw new Error("db down");
      }
    });

    await expect(run()).rejects.toThrow("db down");
    expect(commits).toHaveBeenCalledTimes(1);
    expect(Math.max(...fetched())).toBeLessThan(12);
  });

  it("rejects with the commit failure when inspection fails while that commit is still rejecting", async () => {
    const { run, commits } = setup({ startHeight: 1, endHeight: 6, batchSize: 2, concurrency: 1, rejectHeight: 3 });
    commits.mockImplementation(async () => {
      await delay(20);
      throw new Error("disk full");
    });

    await expect(run()).rejects.toThrow("disk full");
    expect(commits).toHaveBeenCalledTimes(1);
  });

  it("halts before committing a block that fails inspection", async () => {
    const { run, commits } = setup({ startHeight: 1, endHeight: 5, batchSize: 5, concurrency: 5, rejectHeight: 3 });

    await expect(run()).rejects.toThrow("bad block 3");
    expect(commits).not.toHaveBeenCalled();
  });

  it("stops after the in-flight commit when asked to stop and reports the last committed height", async () => {
    const stopped = { value: false };
    const { run, committed, commits } = setup({ startHeight: 1, endHeight: 10, batchSize: 2, concurrency: 2, stopped });
    commits.mockImplementationOnce(async () => {
      stopped.value = true;
    });

    const progress = await run();

    expect(committed()).toEqual([[1, 2]]);
    expect(progress.lastCommittedHeight).toBe(2);
  });

  function setup(input: {
    startHeight: number;
    endHeight: number;
    batchSize: number;
    concurrency: number;
    fetchDelayMs?: (height: number) => number;
    rejectHeight?: number;
    stopped?: { value: boolean };
  }) {
    const fetchedHeights: number[] = [];
    let activeFetches = 0;
    let maxActiveFetches = 0;
    const commits = vi.fn<(batch: DecodedBlock[]) => Promise<void>>().mockResolvedValue(undefined);

    const run = () =>
      runRangePipeline({
        startHeight: input.startHeight,
        endHeight: input.endHeight,
        batchSize: input.batchSize,
        concurrency: input.concurrency,
        fetch: async height => {
          fetchedHeights.push(height);
          activeFetches++;
          maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
          const fetchDelayMs = input.fetchDelayMs?.(height) ?? 0;
          if (fetchDelayMs > 0) {
            await delay(fetchDelayMs);
          }
          activeFetches--;
          return buildDecodedBlock(height);
        },
        inspect: block => {
          if (block.height === input.rejectHeight) {
            throw new Error(`bad block ${block.height}`);
          }
        },
        commit: commits,
        isStopped: () => input.stopped?.value ?? false
      });

    return {
      run,
      commits,
      committed: () => commits.mock.calls.map(call => call[0].map(block => block.height)),
      fetched: () => fetchedHeights,
      maxObservedConcurrency: () => maxActiveFetches
    };
  }

  function buildDecodedBlock(height: number): DecodedBlock {
    return {
      height,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: Buffer.from(`hash-${height}`),
      parentHash: Buffer.from(`hash-${height - 1}`),
      proposerAddress: "PROPOSER",
      transactions: [
        { index: 0, hash: Buffer.from(`tx-${height}`), code: 0, gasUsed: 0, gasWanted: 0, fee: [], messages: [], events: [], signerAddresses: [] }
      ],
      blockEvents: []
    };
  }
});

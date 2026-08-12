import type { ChunkRange, RawBlockRecord } from "@src/archive/archive-layout";
import { CHUNK_SIZE, chunkRangeFor, fetchRawBlock, isRangeContained } from "@src/archive/archive-layout";
import type { BlockArchiveService } from "@src/archive/block-archive.service";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

interface RangeEntry {
  range: ChunkRange;
  /** Only a range fully inside the run's bounds can ever fill a 1,000-block buffer, so partial edge ranges stage singles instead. */
  chunkEligible: boolean;
  chunkFetch: Promise<Map<number, RawBlockRecord> | null> | null;
  buffer: Map<number, RawBlockRecord>;
  stagedHits: Set<number>;
  flush: Promise<void> | null;
}

/**
 * Per-run block source for the backfill runner: serves each height from the archive chunk if one
 * exists, then from a staged single, then from RPC — and compacts every fully-covered chunk range
 * it passes over as a side effect (put chunk, delete consumed staged singles).
 *
 * Failed archive calls reset their cached promise before rethrowing, so the runner's existing
 * retryWithBackoff around getRecord re-attempts a fresh GET/PUT instead of awaiting a poisoned
 * promise; after the runner's attempts are exhausted the Job fails (halt policy).
 */
export class ArchiveBlockSource {
  readonly #archive: BlockArchiveService;
  readonly #pool: RpcClientPool;
  readonly #logger: LoggerService;
  readonly #startHeight: number;
  readonly #endHeight: number;

  /** Keyed by range start. Consumption is strictly ascending with a bounded fetch window, so at most two ranges are ever live. */
  readonly #entries = new Map<number, RangeEntry>();

  constructor(params: { archive: BlockArchiveService; pool: RpcClientPool; logger: LoggerService; startHeight: number; endHeight: number }) {
    this.#archive = params.archive;
    this.#pool = params.pool;
    this.#logger = params.logger;
    this.#startHeight = params.startHeight;
    this.#endHeight = params.endHeight;
  }

  async getRecord(height: number): Promise<RawBlockRecord> {
    if (!this.#archive.isEnabled()) {
      return await fetchRawBlock(this.#pool, height);
    }

    const entry = this.#entryFor(height);
    const chunkRecord = (await this.#fetchChunk(entry))?.get(height);
    if (chunkRecord) {
      return chunkRecord;
    }

    let record = entry.buffer.get(height);
    if (!record) {
      record = await this.#loadRecord(entry, height);
      entry.buffer.set(height, record);
    }

    if (entry.chunkEligible && entry.buffer.size === CHUNK_SIZE) {
      await this.#flush(entry);
    }

    return record;
  }

  #entryFor(height: number): RangeEntry {
    const range = chunkRangeFor(height);
    let entry = this.#entries.get(range.start);

    if (!entry) {
      entry = {
        range,
        chunkEligible: isRangeContained(range, this.#startHeight, this.#endHeight),
        chunkFetch: null,
        buffer: new Map(),
        stagedHits: new Set(),
        flush: null
      };
      this.#entries.set(range.start, entry);
      this.#evictBehind(range.start);
    }

    return entry;
  }

  #evictBehind(newStart: number): void {
    for (const start of this.#entries.keys()) {
      if (start <= newStart - 2 * CHUNK_SIZE) {
        this.#entries.delete(start);
      }
    }
  }

  /** Attempted for every range — a partial edge range may still be covered by a chunk from an earlier full replay. */
  #fetchChunk(entry: RangeEntry): Promise<Map<number, RawBlockRecord> | null> {
    entry.chunkFetch ??= this.#archive.getChunk(entry.range).then(
      records => records && new Map(records.map(record => [record.height, record])),
      error => {
        entry.chunkFetch = null;
        throw error;
      }
    );
    return entry.chunkFetch;
  }

  async #loadRecord(entry: RangeEntry, height: number): Promise<RawBlockRecord> {
    const staged = await this.#archive.getStagedBlock(height);
    if (staged) {
      entry.stagedHits.add(height);
      return staged;
    }

    const record = await fetchRawBlock(this.#pool, height);
    if (!entry.chunkEligible) {
      await this.#archive.putStagedBlockIfAbsent(record);
    }
    return record;
  }

  async #flush(entry: RangeEntry): Promise<void> {
    entry.flush ??= this.#flushChunk(entry);
    try {
      await entry.flush;
    } catch (error) {
      entry.flush = null;
      throw error;
    }
  }

  async #flushChunk(entry: RangeEntry): Promise<void> {
    const records = [...entry.buffer.values()].sort((a, b) => a.height - b.height);
    await this.#archive.putChunkIfAbsent(entry.range, records);
    await this.#archive.deleteStagedBlocks([...entry.stagedHits]);
    this.#logger.info({
      event: "ARCHIVE_RANGE_COMPACTED",
      startHeight: entry.range.start,
      endHeight: entry.range.end,
      stagedConsumed: entry.stagedHits.size
    });
    entry.buffer.clear();
    entry.stagedHits.clear();
  }
}

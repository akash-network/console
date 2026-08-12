import { inject, singleton } from "tsyringe";

import { decodeRecords, encodeRecords } from "@src/archive/archive-codec";
import type { ChunkRange, RawBlockRecord } from "@src/archive/archive-layout";
import { chunkKey, stagedBlockKey } from "@src/archive/archive-layout";
import type { EnvConfig } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ArchiveObjectStore } from "@src/providers/archive.provider";
import { ARCHIVE_STORAGE } from "@src/providers/archive.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

const DELETE_BATCH_SIZE = 25;
const SAVE_OPTIONS = { resumable: false, contentType: "application/zstd", preconditionOpts: { ifGenerationMatch: 0 } };

@singleton()
export class BlockArchiveService {
  readonly #storage: ArchiveObjectStore | null;
  readonly #config: EnvConfig;
  readonly #pool: RpcClientPool;
  readonly #logger: LoggerService;

  #chainId: Promise<string> | null = null;

  constructor(
    @inject(ARCHIVE_STORAGE) storage: ArchiveObjectStore | null,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(RpcClientPool) pool: RpcClientPool,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#storage = storage;
    this.#config = config;
    this.#pool = pool;
    this.#logger = logger;
    this.#logger.setContext("ARCHIVE");
  }

  isEnabled(): boolean {
    return this.#storage !== null;
  }

  logState(): void {
    if (this.isEnabled()) {
      this.#logger.info({ event: "ARCHIVE_ENABLED", bucket: this.#config.ARCHIVE_BUCKET });
    } else {
      this.#logger.info({ event: "ARCHIVE_DISABLED" });
    }
  }

  async getChunk(range: ChunkRange): Promise<RawBlockRecord[] | null> {
    const buffer = await this.#download(chunkKey(await this.#resolveChainId(), range));
    return buffer ? decodeRecords(buffer) : null;
  }

  async getStagedBlock(height: number): Promise<RawBlockRecord | null> {
    const buffer = await this.#download(stagedBlockKey(await this.#resolveChainId(), height));
    return buffer ? decodeRecords(buffer)[0] ?? null : null;
  }

  /**
   * A chunk's existence short-circuits staged reads and triggers staged-single deletion, so a
   * partial chunk could destroy the only copy of blocks; the record count makes that impossible.
   */
  async putChunkIfAbsent(range: ChunkRange, records: RawBlockRecord[]): Promise<void> {
    const expectedCount = range.end - range.start + 1;
    if (records.length !== expectedCount) {
      throw new Error(`Chunk ${range.start}-${range.end} requires ${expectedCount} records, got ${records.length}`);
    }
    await this.#saveIfAbsent(chunkKey(await this.#resolveChainId(), range), encodeRecords(records));
  }

  async putStagedBlockIfAbsent(record: RawBlockRecord): Promise<void> {
    await this.#saveIfAbsent(stagedBlockKey(await this.#resolveChainId(), record.height), encodeRecords([record]));
  }

  async deleteStagedBlocks(heights: number[]): Promise<void> {
    if (!this.isEnabled() || heights.length === 0) {
      return;
    }

    const chainId = await this.#resolveChainId().catch(() => null);
    if (chainId === null) {
      this.#logger.warn({
        event: "ARCHIVE_STAGED_DELETE_FAILED",
        reason: "chain id unavailable",
        heightCount: heights.length,
        firstHeight: heights[0],
        lastHeight: heights[heights.length - 1]
      });
      return;
    }

    for (let offset = 0; offset < heights.length; offset += DELETE_BATCH_SIZE) {
      const batch = heights.slice(offset, offset + DELETE_BATCH_SIZE);
      const outcomes = await Promise.allSettled(batch.map(height => this.#file(stagedBlockKey(chainId, height)).delete({ ignoreNotFound: true })));
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "rejected") {
          this.#logger.warn({ event: "ARCHIVE_STAGED_DELETE_FAILED", height: batch[index], error: outcome.reason });
        }
      });
    }
  }

  async #saveIfAbsent(key: string, data: Buffer): Promise<void> {
    try {
      await this.#file(key).save(data, SAVE_OPTIONS);
    } catch (error) {
      if (statusCodeOf(error) !== 412) {
        throw error;
      }
      this.#logger.debug({ event: "ARCHIVE_OBJECT_EXISTS", key });
    }
  }

  async #download(key: string): Promise<Buffer | null> {
    try {
      const [buffer] = await this.#file(key).download();
      return buffer;
    } catch (error) {
      if (statusCodeOf(error) !== 404) {
        throw error;
      }
      return null;
    }
  }

  #file(key: string): ReturnType<ReturnType<ArchiveObjectStore["bucket"]>["file"]> {
    if (!this.#storage || !this.#config.ARCHIVE_BUCKET) {
      throw new Error("Raw block archive is disabled; check isEnabled() before calling the archive");
    }
    return this.#storage.bucket(this.#config.ARCHIVE_BUCKET).file(key);
  }

  /**
   * The chain id (e.g. sandbox-01) namespaces every object key so a chain reset cannot mix
   * archives. Concurrent callers share one in-flight /status request; a rejected fetch clears
   * the cache so the caller's retry re-fetches instead of failing forever.
   */
  #resolveChainId(): Promise<string> {
    this.#chainId ??= this.#pool.getStatus().then(
      status => status.node_info.network,
      error => {
        this.#chainId = null;
        throw error;
      }
    );
    return this.#chainId;
  }
}

function statusCodeOf(error: unknown): number | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "number" ? code : null;
}

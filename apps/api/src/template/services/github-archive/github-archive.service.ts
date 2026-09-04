import { ExponentialBackoff, handleWhen, retry, type RetryPolicy } from "cockatiel";
import { LRUCache } from "lru-cache";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import tar from "tar";

import type { CreateLogger } from "@src/core";
import type { CacheLimits } from "../../../caching/cache-registry.ts";
import { cacheRegistry, NOMINAL_ENTRY_BYTES } from "../../../caching/cache-registry.ts";

/** The template repo archives are ~70 MB each, so the download budget has to bound stalls rather than total transfer time. */
const DOWNLOAD_STALL_TIMEOUT_MS = 30_000;

const MAX_CACHED_ARCHIVES = 10;
/** Filtered to template files the gallery's archives retain ~2.3 MB each, so this leaves room for an order of magnitude of repo growth. */
const MAX_CACHED_ARCHIVES_TOTAL_BYTES = 128 * 1024 * 1024;

/** Half the total so one archive can never evict every other one, and an archive above it is still parsed and returned since getArchive resolves from the parse. */
function maxBytesPerArchive(maxTotalBytes: number): number {
  return maxTotalBytes / 2;
}

/** The placeholder charged while a download is in flight must fit the ceiling, or lru-cache refuses the entry and concurrent callers each start their own download. */
function inFlightArchiveBytes(maxArchiveBytes: number): number {
  return Math.min(NOMINAL_ENTRY_BYTES, maxArchiveBytes);
}

const MAX_DOWNLOAD_RETRIES = 2;
const RETRY_INITIAL_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 10_000;

/** Only a missing or deleted archive will never appear; 403 and 429 are GitHub rate limits that clear on their own. */
const PERMANENTLY_UNAVAILABLE_STATUSES = new Set([404, 410]);

class ArchiveNotAvailableError extends Error {}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface ArchiveReader {
  readFile(path: string): Promise<string | null>;
  listDirectory(path: string): DirectoryEntry[];
  retainedBytes: number;
}

interface ParsedArchive {
  files: Map<string, string>;
  directories: Map<string, DirectoryEntry[]>;
  retainedBytes: number;
}

async function* streamWhileMakingProgress(body: ReadableStream<Uint8Array>, onProgress: () => void) {
  const reader = body.getReader();

  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      onProgress();
      yield chunk.value;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export class GitHubArchiveService {
  readonly #cache: LRUCache<string, Promise<ArchiveReader>>;
  readonly #maxArchiveBytes: number;
  readonly #logger: ReturnType<CreateLogger>;
  readonly #downloadPolicy: RetryPolicy;

  constructor(logger: ReturnType<CreateLogger>, limits: CacheLimits = {}) {
    const maxTotalBytes = limits.maxTotalBytes ?? MAX_CACHED_ARCHIVES_TOTAL_BYTES;
    this.#maxArchiveBytes = limits.maxEntryBytes ?? maxBytesPerArchive(maxTotalBytes);
    this.#cache = new LRUCache<string, Promise<ArchiveReader>>({
      max: limits.maxEntries ?? MAX_CACHED_ARCHIVES,
      maxSize: maxTotalBytes,
      maxEntrySize: this.#maxArchiveBytes,
      sizeCalculation: () => inFlightArchiveBytes(this.#maxArchiveBytes)
    });
    this.#logger = logger;
    cacheRegistry.register("GitHubArchiveService#archives", this.#cache);
    this.#downloadPolicy = retry(
      handleWhen(error => !(error instanceof ArchiveNotAvailableError)),
      {
        maxAttempts: MAX_DOWNLOAD_RETRIES,
        backoff: new ExponentialBackoff({ initialDelay: RETRY_INITIAL_DELAY_MS, maxDelay: RETRY_MAX_DELAY_MS })
      }
    );
  }

  async getArchive(owner: string, repo: string, ref: string, fileFilter?: (relativePath: string) => boolean): Promise<ArchiveReader> {
    const filterKey = fileFilter ? fileFilter.name || "filtered" : "unfiltered";
    const cacheKey = `${owner}/${repo}/${ref}:${filterKey}`;

    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const promise = this.#downloadAndParse(owner, repo, ref, fileFilter);
    this.#cache.set(cacheKey, promise);

    try {
      const reader = await promise;
      this.#chargeRetainedBytes(cacheKey, promise, reader.retainedBytes);
      return reader;
    } catch (error) {
      this.#cache.delete(cacheKey);
      throw error;
    }
  }

  clearCache(): void {
    this.#cache.clear();
  }

  /** lru-cache ignores a size given for a value it already holds, so the parsed archive has to replace its own in-flight entry. */
  #chargeRetainedBytes(cacheKey: string, archive: Promise<ArchiveReader>, retainedBytes: number): void {
    this.#cache.delete(cacheKey);

    if (retainedBytes > this.#maxArchiveBytes) {
      this.#logger.warn({ event: "ARCHIVE_TOO_LARGE_TO_CACHE", cacheKey, retainedBytes, maxArchiveBytes: this.#maxArchiveBytes });
      return;
    }

    this.#cache.set(cacheKey, archive, { size: retainedBytes });
  }

  async #downloadAndParse(owner: string, repo: string, ref: string, fileFilter?: (relativePath: string) => boolean): Promise<ArchiveReader> {
    const url = `https://github.com/${owner}/${repo}/archive/${ref}.tar.gz`;

    const parsedArchive = await this.#downloadPolicy.execute(async ({ attempt }) => {
      try {
        return await this.#downloadAndExtract(url, fileFilter);
      } catch (error) {
        this.#logger.warn({
          event: "ARCHIVE_DOWNLOAD_ATTEMPT_FAILED",
          url,
          attempt: attempt + 1,
          maxAttempts: MAX_DOWNLOAD_RETRIES + 1,
          error
        });
        throw error;
      }
    });

    return this.#createArchiveReader(parsedArchive);
  }

  async #downloadAndExtract(url: string, fileFilter?: (relativePath: string) => boolean): Promise<ParsedArchive> {
    const abortWhenStalled = new AbortController();
    let stallTimer: NodeJS.Timeout | undefined;

    const restartStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(
        () => abortWhenStalled.abort(new Error(`Archive download from ${url} received no data for ${DOWNLOAD_STALL_TIMEOUT_MS}ms`)),
        DOWNLOAD_STALL_TIMEOUT_MS
      );
    };

    try {
      restartStallTimer();
      const response = await fetch(url, { signal: abortWhenStalled.signal });

      if (!response.ok) {
        const message = `Failed to download archive from ${url}: ${response.status} ${response.statusText}`;
        throw PERMANENTLY_UNAVAILABLE_STATUSES.has(response.status) ? new ArchiveNotAvailableError(message) : new Error(message);
      }

      if (!response.body) {
        throw new Error(`Archive download from ${url} returned no body`);
      }

      return await this.#extractArchive(Readable.from(streamWhileMakingProgress(response.body, restartStallTimer)), fileFilter);
    } finally {
      clearTimeout(stallTimer);
    }
  }

  async #extractArchive(source: Readable, fileFilter?: (relativePath: string) => boolean): Promise<ParsedArchive> {
    const files = new Map<string, string>();
    const dirChildren = new Map<string, Map<string, DirectoryEntry>>();
    let rootPrefix = "";
    let rootDetected = false;
    let retainedBytes = 0;

    const parser = new tar.Parse({
      onentry: (entry: tar.ReadEntry) => {
        if (!rootDetected) {
          const slashIndex = entry.path.indexOf("/");
          rootPrefix = slashIndex !== -1 ? entry.path.slice(0, slashIndex + 1) : "";
          rootDetected = true;
        }

        const relativePath = entry.path.startsWith(rootPrefix) ? entry.path.slice(rootPrefix.length) : entry.path;

        if (!relativePath) {
          entry.resume();
          return;
        }

        const isDir = entry.type === "Directory";

        this.#registerInParentDirectory(dirChildren, relativePath, isDir);
        retainedBytes += Buffer.byteLength(relativePath);

        if (isDir) {
          const cleanPath = relativePath.endsWith("/") ? relativePath.slice(0, -1) : relativePath;
          if (!dirChildren.has(cleanPath)) {
            dirChildren.set(cleanPath, new Map());
          }
          entry.resume();
          return;
        }

        if (fileFilter && !fileFilter(relativePath)) {
          entry.resume();
          return;
        }

        const chunks: Buffer[] = [];
        entry.on("data", (chunk: Buffer) => chunks.push(chunk));
        entry.on("end", () => {
          const content = Buffer.concat(chunks);
          retainedBytes += content.byteLength;
          files.set(relativePath, content.toString("utf-8"));
        });
        entry.on("error", (error: Error) => {
          this.#logger.warn({
            event: "ARCHIVE_READ_STREAM_ERROR",
            relativePath,
            error
          });
        });
      }
    });

    await pipeline(source, createGunzip(), parser);

    const directories = new Map<string, DirectoryEntry[]>();
    for (const [dirPath, childMap] of dirChildren) {
      directories.set(dirPath, Array.from(childMap.values()));
    }

    return { files, directories, retainedBytes };
  }

  #registerInParentDirectory(dirChildren: Map<string, Map<string, DirectoryEntry>>, relativePath: string, isDir: boolean): void {
    const cleanPath = isDir ? (relativePath.endsWith("/") ? relativePath.slice(0, -1) : relativePath) : relativePath;
    const lastSlash = cleanPath.lastIndexOf("/");
    const parentPath = lastSlash === -1 ? "" : cleanPath.slice(0, lastSlash);
    const name = lastSlash === -1 ? cleanPath : cleanPath.slice(lastSlash + 1);

    if (!dirChildren.has(parentPath)) {
      dirChildren.set(parentPath, new Map());
    }

    const parent = dirChildren.get(parentPath)!;
    if (!parent.has(name)) {
      parent.set(name, {
        name,
        path: cleanPath,
        type: isDir ? "dir" : "file"
      });
    }
  }

  static #normalizePath(value: string): string {
    return value.replace(/^(?:\.\/|\/)+/, "").replace(/\/+$/, "");
  }

  #createArchiveReader(parsed: ParsedArchive): ArchiveReader {
    return {
      retainedBytes: parsed.retainedBytes,

      async readFile(path: string): Promise<string | null> {
        return parsed.files.get(GitHubArchiveService.#normalizePath(path)) ?? null;
      },

      listDirectory(path: string): DirectoryEntry[] {
        return parsed.directories.get(GitHubArchiveService.#normalizePath(path)) ?? [];
      }
    };
  }
}

import { LRUCache } from "lru-cache";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import tar from "tar";

import type { LoggerService } from "@src/core";

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface ArchiveReader {
  readFile(path: string): Promise<string | null>;
  listDirectory(path: string): DirectoryEntry[];
}

interface ParsedArchive {
  files: Map<string, string>;
  directories: Map<string, DirectoryEntry[]>;
}

export class GitHubArchiveService {
  readonly #cache = new LRUCache<string, Promise<ArchiveReader>>({ max: 10 });
  readonly #logger: LoggerService;

  constructor(logger: LoggerService) {
    this.#logger = logger;
  }

  async getArchive(owner: string, repo: string, ref: string, fileFilter?: (relativePath: string) => boolean): Promise<ArchiveReader> {
    const filterKey = fileFilter ? fileFilter.name || "filtered" : "unfiltered";
    const cacheKey = `${owner}/${repo}/${ref}:${filterKey}`;

    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const promise = this.#downloadAndParse(owner, repo, ref, fileFilter);
    this.#cache.set(cacheKey, promise);

    try {
      return await promise;
    } catch (error) {
      this.#cache.delete(cacheKey);
      throw error;
    }
  }

  clearCache(): void {
    this.#cache.clear();
  }

  async #downloadAndParse(owner: string, repo: string, ref: string, fileFilter?: (relativePath: string) => boolean): Promise<ArchiveReader> {
    const url = `https://github.com/${owner}/${repo}/archive/${ref}.tar.gz`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });

    if (!response.ok) {
      throw new Error(`Failed to download archive from ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const parsed = await this.#extractArchive(buffer, fileFilter);

    return this.#createArchiveReader(parsed);
  }

  async #extractArchive(buffer: Buffer, fileFilter?: (relativePath: string) => boolean): Promise<ParsedArchive> {
    const files = new Map<string, string>();
    const dirChildren = new Map<string, Map<string, DirectoryEntry>>();
    let rootPrefix = "";
    let rootDetected = false;

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
          files.set(relativePath, Buffer.concat(chunks).toString("utf-8"));
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

    await pipeline(Readable.from(buffer), createGunzip(), parser);

    const directories = new Map<string, DirectoryEntry[]>();
    for (const [dirPath, childMap] of dirChildren) {
      directories.set(dirPath, Array.from(childMap.values()));
    }

    return { files, directories };
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
      async readFile(path: string): Promise<string | null> {
        return parsed.files.get(GitHubArchiveService.#normalizePath(path)) ?? null;
      },

      listDirectory(path: string): DirectoryEntry[] {
        return parsed.directories.get(GitHubArchiveService.#normalizePath(path)) ?? [];
      }
    };
  }
}

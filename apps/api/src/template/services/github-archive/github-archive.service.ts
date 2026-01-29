import { LRUCache } from "lru-cache";
import yauzl from "yauzl";

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
    const url = `https://github.com/${owner}/${repo}/archive/${ref}.zip`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });

    if (!response.ok) {
      throw new Error(`Failed to download archive from ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const parsed = await this.#extractArchive(buffer, fileFilter);

    return this.#createArchiveReader(parsed);
  }

  #extractArchive(buffer: Buffer, fileFilter?: (relativePath: string) => boolean): Promise<ParsedArchive> {
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new Error("Failed to open ZIP"));

        const files = new Map<string, string>();
        const dirChildren = new Map<string, Map<string, DirectoryEntry>>();
        let rootPrefix = "";
        let rootDetected = false;

        zipfile.readEntry();

        zipfile.on("entry", (entry: yauzl.Entry) => {
          if (!rootDetected) {
            const slashIndex = entry.fileName.indexOf("/");
            rootPrefix = slashIndex !== -1 ? entry.fileName.slice(0, slashIndex + 1) : "";
            rootDetected = true;
          }

          const relativePath = entry.fileName.startsWith(rootPrefix) ? entry.fileName.slice(rootPrefix.length) : entry.fileName;

          if (!relativePath) {
            zipfile.readEntry();
            return;
          }

          const isDir = entry.fileName.endsWith("/");

          this.#registerInParentDirectory(dirChildren, relativePath, isDir);

          if (isDir) {
            if (!dirChildren.has(relativePath.slice(0, -1))) {
              dirChildren.set(relativePath.slice(0, -1), new Map());
            }
            zipfile.readEntry();
            return;
          }

          if (fileFilter && !fileFilter(relativePath)) {
            zipfile.readEntry();
            return;
          }

          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              this.#logger.warn({
                event: "ARCHIVE_OPEN_READ_STREAM_FAILED",
                relativePath,
                error: streamErr ?? new Error("readStream is null")
              });
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
            readStream.on("end", () => {
              files.set(relativePath, Buffer.concat(chunks).toString("utf-8"));
              zipfile.readEntry();
            });
            readStream.on("error", (error: Error) => {
              this.#logger.warn({
                event: "ARCHIVE_READ_STREAM_ERROR",
                relativePath,
                error
              });
              zipfile.readEntry();
            });
          });
        });

        zipfile.on("end", () => {
          const directories = new Map<string, DirectoryEntry[]>();
          for (const [dirPath, childMap] of dirChildren) {
            directories.set(dirPath, Array.from(childMap.values()));
          }
          resolve({ files, directories });
        });

        zipfile.on("error", reject);
      });
    });
  }

  #registerInParentDirectory(dirChildren: Map<string, Map<string, DirectoryEntry>>, relativePath: string, isDir: boolean): void {
    const cleanPath = isDir ? relativePath.slice(0, -1) : relativePath;
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

import { gzipSync } from "node:zlib";
import tar from "tar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheRegistry } from "@src/caching/cache-registry";
import type { CreateLogger } from "@src/core";
import { GitHubArchiveService } from "./github-archive.service";

const BEYOND_ALL_RETRY_BACKOFFS_MS = 60_000;

describe(GitHubArchiveService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("getArchive with fileFilter", () => {
    it("only stores content for files matching the filter", async () => {
      const { service, installArchive } = setup();
      await installArchive({
        "root/readme.md": "# Hello",
        "root/deploy.yaml": "deploy content",
        "root/large-binary.bin": "should be skipped",
        "root/src/index.ts": "should also be skipped"
      });

      const filter = (relativePath: string) => {
        const name = relativePath.split("/").pop()?.toLowerCase() ?? "";
        return name === "readme.md" || name === "deploy.yaml";
      };

      const reader = await service.getArchive("owner", "repo", "ref", filter);

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(await reader.readFile("deploy.yaml")).toBe("deploy content");
      expect(await reader.readFile("large-binary.bin")).toBeNull();
      expect(await reader.readFile("src/index.ts")).toBeNull();
    });

    it("preserves directory listings regardless of filter", async () => {
      const { service, installArchive } = setup();
      await installArchive({
        "root/sub/readme.md": "content",
        "root/sub/image.png": "binary data",
        "root/sub/nested/file.txt": "text"
      });

      const filter = (relativePath: string) => relativePath.endsWith("readme.md");

      const reader = await service.getArchive("owner", "repo", "ref", filter);

      const subEntries = reader.listDirectory("sub");
      const entryNames = subEntries.map(e => e.name);
      expect(entryNames).toContain("readme.md");
      expect(entryNames).toContain("image.png");
      expect(entryNames).toContain("nested");
    });

    it("returns null for readFile on filtered-out files", async () => {
      const { service, installArchive } = setup();
      await installArchive({
        "root/keep.md": "kept",
        "root/skip.txt": "skipped"
      });

      const filter = (relativePath: string) => relativePath.endsWith(".md");

      const reader = await service.getArchive("owner", "repo", "ref", filter);

      expect(await reader.readFile("keep.md")).toBe("kept");
      expect(await reader.readFile("skip.txt")).toBeNull();
    });
  });

  describe("getArchive without fileFilter", () => {
    it("extracts all files when no filter is provided", async () => {
      const { service, installArchive } = setup();
      await installArchive({
        "root/readme.md": "# Hello",
        "root/image.png": "binary data",
        "root/src/index.ts": "code"
      });

      const reader = await service.getArchive("owner", "repo", "ref");

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(await reader.readFile("image.png")).toBe("binary data");
      expect(await reader.readFile("src/index.ts")).toBe("code");
    });
  });

  describe("cache byte accounting", () => {
    it("charges the cached archive the bytes it retained", async () => {
      const { service, installArchive, cacheStats } = setup();
      await installArchive({ "root/readme.md": "# Hello" });

      const reader = await service.getArchive("owner", "repo", "ref");

      expect(reader.retainedBytes).toBeGreaterThan(0);
      expect(cacheStats()).toMatchObject({ entryCount: 1, calculatedSizeBytes: reader.retainedBytes });
    });

    it("leaves the content of filtered-out files out of the charge", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      const skippedContent = "0123456789";
      const files = { "root/readme.md": "# Hello", "root/skip.txt": skippedContent };
      fetchSpy.mockImplementation(async () => archiveResponse(files));

      const filtered = await service.getArchive("owner", "repo", "filtered", (relativePath: string) => relativePath.endsWith(".md"));
      const unfiltered = await service.getArchive("owner", "repo", "unfiltered");

      expect(unfiltered.retainedBytes - filtered.retainedBytes).toBe(skippedContent.length);
    });
  });

  describe("cache byte bounds", () => {
    const ARCHIVE_CONTENT = "x".repeat(1500);

    it("evicts the least recently used archive once the cached archives exceed the total byte bound", async () => {
      const maxTotalBytes = 3000;
      const { service, fetchSpy, archiveResponse, cacheStats } = setup({ maxTotalBytes, maxEntryBytes: 2000 });
      fetchSpy.mockImplementation(async () => archiveResponse({ "root/readme.md": ARCHIVE_CONTENT }));

      const first = await service.getArchive("owner", "repo", "first");
      await service.getArchive("owner", "repo", "second");
      await service.getArchive("owner", "repo", "first");

      expect(first.retainedBytes * 2).toBeGreaterThan(maxTotalBytes);
      expect(cacheStats()).toMatchObject({ entryCount: 1 });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("keeps every archive that fits within the total byte bound", async () => {
      const { service, fetchSpy, archiveResponse, cacheStats } = setup({ maxTotalBytes: 8000, maxEntryBytes: 2000 });
      fetchSpy.mockImplementation(async () => archiveResponse({ "root/readme.md": ARCHIVE_CONTENT }));

      await service.getArchive("owner", "repo", "first");
      await service.getArchive("owner", "repo", "second");
      await service.getArchive("owner", "repo", "first");

      expect(cacheStats()).toMatchObject({ entryCount: 2 });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("shares one download between concurrent callers even when a limit sits below the nominal entry charge", async () => {
      const { service, fetchSpy, archiveResponse } = setup({ maxTotalBytes: 2000, maxEntryBytes: 900 });
      fetchSpy.mockImplementation(async () => archiveResponse({ "root/readme.md": "# Hello" }));

      const [first, second] = await Promise.all([service.getArchive("owner", "repo", "ref"), service.getArchive("owner", "repo", "ref")]);

      expect(first).toBe(second);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("returns an archive too large to keep and warns instead of caching it", async () => {
      const maxEntryBytes = 1000;
      const { service, logger, installArchive, cacheStats } = setup({ maxEntryBytes });
      await installArchive({ "root/readme.md": ARCHIVE_CONTENT });

      const reader = await service.getArchive("owner", "repo", "ref");

      expect(await reader.readFile("readme.md")).toBe(ARCHIVE_CONTENT);
      expect(cacheStats()).toMatchObject({ entryCount: 0 });
      expect(logger.warn).toHaveBeenCalledWith({
        event: "ARCHIVE_TOO_LARGE_TO_CACHE",
        cacheKey: "owner/repo/ref:unfiltered",
        retainedBytes: reader.retainedBytes,
        maxArchiveBytes: maxEntryBytes
      });
    });
  });

  describe("download resilience", () => {
    it("retries when a download fails and succeeds on a later attempt", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      fetchSpy.mockRejectedValueOnce(new Error("socket hang up")).mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const archive = service.getArchive("owner", "repo", "ref");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      const reader = await archive;

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("gives up after exhausting all attempts and reports the last error", async () => {
      const { service, fetchSpy } = setup();
      fetchSpy.mockRejectedValue(new Error("socket hang up"));

      const failed = expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow("socket hang up");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);

      await failed;
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("does not retry when github reports the archive is unavailable", async () => {
      const { service, fetchSpy } = setup();
      fetchSpy.mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" }));

      await expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow("404 Not Found");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries when the response body fails part way through the download", async () => {
      const { service, fetchSpy, archiveResponse, tarGzChunks } = setup();
      const truncated = tarGzChunks({ "root/readme.md": "# Hello" }).slice(0, 2);
      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            new ReadableStream({
              pull(controller) {
                const chunk = truncated.shift();
                if (chunk) return controller.enqueue(chunk);
                controller.error(new TypeError("terminated"));
              }
            })
          )
        )
        .mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const archive = service.getArchive("owner", "repo", "ref");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      const reader = await archive;

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries when fetch itself fails at the transport level", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      const transportFailure = new TypeError("fetch failed");
      transportFailure.cause = new Error("HeadersTimeoutError");
      fetchSpy.mockRejectedValueOnce(transportFailure).mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const archive = service.getArchive("owner", "repo", "ref");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      const reader = await archive;

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries a TimeoutError raised by an aborted fetch", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      fetchSpy
        .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
        .mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const archive = service.getArchive("owner", "repo", "ref");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      const reader = await archive;

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("cancels the response body when extraction fails so the connection is released", async () => {
      const { service, fetchSpy } = setup();
      const cancelSource = vi.fn();
      fetchSpy.mockImplementation(() =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              pull(controller) {
                controller.enqueue(new Uint8Array(1024));
              },
              cancel: cancelSource
            })
          )
        )
      );

      const failed = expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      await failed;

      expect(cancelSource).toHaveBeenCalled();
    });

    it("retries when github rate limits the download", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 429, statusText: "Too Many Requests" }))
        .mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const archive = service.getArchive("owner", "repo", "ref");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      const reader = await archive;

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries when github fails the download with a server error", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 502, statusText: "Bad Gateway" }))
        .mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const archive = service.getArchive("owner", "repo", "ref");
      await vi.advanceTimersByTimeAsync(BEYOND_ALL_RETRY_BACKOFFS_MS);
      const reader = await archive;

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("aborts when the response body goes silent part way through the download", async () => {
      const { service, fetchSpy, tarGzChunks } = setup();
      const [firstChunk] = tarGzChunks({ "root/readme.md": "# Hello" });
      fetchSpy.mockImplementation((_url, init) => {
        const signal = (init as RequestInit).signal!;
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
                controller.enqueue(firstChunk);
              }
            })
          )
        );
      });

      const stalled = expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow("received no data for 30000ms");
      await vi.advanceTimersByTimeAsync(3 * 30_000 + BEYOND_ALL_RETRY_BACKOFFS_MS);

      await stalled;
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("aborts a download that stops producing data", async () => {
      const { service, fetchSpy } = setup();
      fetchSpy.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal!;
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          })
      );

      const stalled = expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow("received no data for 30000ms");
      await vi.advanceTimersByTimeAsync(3 * 30_000 + BEYOND_ALL_RETRY_BACKOFFS_MS);

      await stalled;
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("keeps downloading while data keeps arriving past the stall timeout", async () => {
      const { service, fetchSpy, tarGzChunks } = setup();
      const chunks = tarGzChunks({ "root/readme.md": "# Hello" });
      fetchSpy.mockImplementation(() =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              async pull(controller) {
                const chunk = chunks.shift();
                if (!chunk) return controller.close();
                await vi.advanceTimersByTimeAsync(20_000);
                controller.enqueue(chunk);
              }
            })
          )
        )
      );

      const reader = await service.getArchive("owner", "repo", "ref");

      expect(await reader.readFile("readme.md")).toBe("# Hello");
    });
  });

  function setup(input?: { maxTotalBytes?: number; maxEntryBytes?: number }) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const logger = mock<ReturnType<CreateLogger>>();
    const namesBeforeRegistration = new Set(cacheRegistry.getStats().map(stats => stats.name));
    const service = new GitHubArchiveService(logger, input);
    const cacheName = cacheRegistry.getStats().find(stats => !namesBeforeRegistration.has(stats.name))!.name;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    function archiveResponse(files: Record<string, string>) {
      return new Response(new Uint8Array(createTarGzBuffer(files)), {
        status: 200,
        headers: { "Content-Type": "application/gzip" }
      });
    }

    function tarGzChunks(files: Record<string, string>, chunkSize = 64) {
      const buffer = createTarGzBuffer(files);
      const chunks: Uint8Array[] = [];
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        chunks.push(new Uint8Array(buffer.subarray(offset, offset + chunkSize)));
      }
      return chunks;
    }

    async function installArchive(files: Record<string, string>) {
      fetchSpy.mockResolvedValue(archiveResponse(files));
    }

    const cacheStats = () => cacheRegistry.getStats().find(stats => stats.name === cacheName);

    return { service, logger, installArchive, fetchSpy, archiveResponse, tarGzChunks, cacheStats };
  }

  function createTarGzBuffer(files: Record<string, string>): Buffer {
    const blocks: Buffer[] = [];

    function addEntry(path: string, type: "Directory" | "File", content?: string) {
      const buf = content ? Buffer.from(content) : Buffer.alloc(0);
      const header = new tar.Header({
        path,
        type,
        mode: type === "Directory" ? 0o755 : 0o644,
        size: buf.length,
        mtime: new Date(0),
        uid: 0,
        gid: 0,
        uname: "",
        gname: ""
      });
      header.encode();
      blocks.push(header.block);

      if (buf.length > 0) {
        const padded = Buffer.alloc(Math.ceil(buf.length / 512) * 512);
        buf.copy(padded);
        blocks.push(padded);
      }
    }

    const dirs = new Set<string>();
    for (const filePath of Object.keys(files)) {
      const parts = filePath.split("/");
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join("/") + "/";
        if (!dirs.has(dirPath)) {
          dirs.add(dirPath);
          addEntry(dirPath, "Directory");
        }
      }
    }

    for (const [filePath, content] of Object.entries(files)) {
      addEntry(filePath, "File", content);
    }

    blocks.push(Buffer.alloc(1024));

    return gzipSync(Buffer.concat(blocks));
  }
});

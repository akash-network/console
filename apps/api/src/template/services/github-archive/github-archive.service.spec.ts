import { gzipSync } from "node:zlib";
import tar from "tar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { GitHubArchiveService } from "./github-archive.service";

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

  describe("download resilience", () => {
    it("retries when a download fails and succeeds on a later attempt", async () => {
      const { service, fetchSpy, archiveResponse } = setup();
      fetchSpy.mockRejectedValueOnce(new Error("socket hang up")).mockResolvedValueOnce(archiveResponse({ "root/readme.md": "# Hello" }));

      const reader = await service.getArchive("owner", "repo", "ref");

      expect(await reader.readFile("readme.md")).toBe("# Hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("gives up after exhausting all attempts and reports the last error", async () => {
      const { service, fetchSpy } = setup();
      fetchSpy.mockRejectedValue(new Error("socket hang up"));

      await expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow("socket hang up");
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("does not retry when github reports the archive is unavailable", async () => {
      const { service, fetchSpy } = setup();
      fetchSpy.mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" }));

      await expect(service.getArchive("owner", "repo", "ref")).rejects.toThrow("404 Not Found");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
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
      await vi.advanceTimersByTimeAsync(3 * 30_000);

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

  function setup() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new GitHubArchiveService(logger);
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

    return { service, logger, installArchive, fetchSpy, archiveResponse, tarGzChunks };
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

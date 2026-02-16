import { gzipSync } from "node:zlib";
import tar from "tar";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core";
import { GitHubArchiveService } from "./github-archive.service";

describe(GitHubArchiveService.name, () => {
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

  function setup() {
    const logger = mock<LoggerService>();
    const service = new GitHubArchiveService(logger);

    async function installArchive(files: Record<string, string>) {
      const tarGzBuffer = createTarGzBuffer(files);

      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(new Uint8Array(tarGzBuffer), {
          status: 200,
          headers: { "Content-Type": "application/gzip" }
        })
      );
    }

    return { service, logger, installArchive };
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

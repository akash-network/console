import { mock } from "jest-mock-extended";
import yazl from "yazl";

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
      const zipBuffer = await createZipBuffer(files);

      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(new Uint8Array(zipBuffer), {
          status: 200,
          headers: { "Content-Type": "application/zip" }
        })
      );
    }

    return { service, logger, installArchive };
  }

  function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const zipfile = new yazl.ZipFile();

      const dirs = new Set<string>();
      for (const filePath of Object.keys(files)) {
        const parts = filePath.split("/");
        for (let i = 1; i < parts.length; i++) {
          const dirPath = parts.slice(0, i).join("/") + "/";
          if (!dirs.has(dirPath)) {
            dirs.add(dirPath);
            zipfile.addEmptyDirectory(dirPath);
          }
        }
      }

      for (const [filePath, content] of Object.entries(files)) {
        zipfile.addBuffer(Buffer.from(content), filePath);
      }

      zipfile.end();

      const chunks: Buffer[] = [];
      zipfile.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      zipfile.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
      zipfile.outputStream.on("error", reject);
    });
  }
});

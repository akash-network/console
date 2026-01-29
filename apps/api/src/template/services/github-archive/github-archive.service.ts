import JSZip from "jszip";

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface ArchiveReader {
  readFile(path: string): Promise<string | null>;
  listDirectory(path: string): DirectoryEntry[];
}

export class GitHubArchiveService {
  readonly #cache = new Map<string, Promise<ArchiveReader>>();

  async getArchive(owner: string, repo: string, ref: string): Promise<ArchiveReader> {
    const cacheKey = `${owner}/${repo}/${ref}`;

    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const promise = this.#downloadAndParse(owner, repo, ref);
    this.#cache.set(cacheKey, promise);

    try {
      return await promise;
    } catch (error) {
      this.#cache.delete(cacheKey);
      throw error;
    }
  }

  async #downloadAndParse(owner: string, repo: string, ref: string): Promise<ArchiveReader> {
    const url = `https://github.com/${owner}/${repo}/archive/${ref}.zip`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download archive from ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const rootPrefix = this.#detectRootPrefix(zip);

    return this.#createArchiveReader(zip, rootPrefix);
  }

  #detectRootPrefix(zip: JSZip): string {
    const firstEntry = Object.keys(zip.files)[0];
    if (!firstEntry) return "";

    const slashIndex = firstEntry.indexOf("/");
    if (slashIndex === -1) return "";

    return firstEntry.slice(0, slashIndex + 1);
  }

  #createArchiveReader(zip: JSZip, rootPrefix: string): ArchiveReader {
    return {
      async readFile(path: string): Promise<string | null> {
        const fullPath = rootPrefix + path;
        const file = zip.file(fullPath);
        if (!file) return null;
        return file.async("string");
      },

      listDirectory(path: string): DirectoryEntry[] {
        const dirPath = rootPrefix + (path ? path + "/" : "");
        const entries: DirectoryEntry[] = [];
        const seen = new Set<string>();

        zip.forEach((relativePath, entry) => {
          if (!relativePath.startsWith(dirPath)) return;

          const remainder = relativePath.slice(dirPath.length);
          if (!remainder) return;

          const slashIndex = remainder.indexOf("/");
          const isDirectChild = slashIndex === -1 || slashIndex === remainder.length - 1;
          if (!isDirectChild) return;

          const name = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
          if (seen.has(name)) return;
          seen.add(name);

          const entryPath = path ? `${path}/${name}` : name;

          entries.push({
            name,
            path: entryPath,
            type: entry.dir ? "dir" : "file"
          });
        });

        return entries;
      }
    };
  }
}

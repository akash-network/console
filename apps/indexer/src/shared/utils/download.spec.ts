import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { download } from "./download";

describe(download.name, () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map(dispose => dispose()));
  });

  it("downloads from an HTTP endpoint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "indexer-download-"));
    const destination = join(directory, "genesis.json");
    const server = createServer((_request, response) => response.end('{"chain_id":"aep-86"}'));
    cleanup.push(
      () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
      () => rm(directory, { recursive: true })
    );

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected an IP listener");

    await download(`http://127.0.0.1:${address.port}/genesis.json`, destination);

    await expect(readFile(destination, "utf8")).resolves.toBe('{"chain_id":"aep-86"}');
  });
});

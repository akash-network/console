import dns from "node:dns";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { BlockList } from "node:net";
import { gzipSync } from "node:zlib";
import { describe, expect, it, onTestFinished } from "vitest";

import { createProviderFetch } from "./fetch";
import { createForbidPrivateNetworkLookup } from "./private-network";

describe(createProviderFetch.name, () => {
  it("refuses a loopback address without dialing it", async () => {
    const provider = await startServer((_req, res) => res.end("{}"));
    const fetchProvider = createProviderFetch();

    await expect(fetchProvider(`${provider.url}/version`)).rejects.toMatchObject({ code: "EFORBIDDEN" });
    expect(provider.hits).toEqual([]);
  });

  it("reaches a host whose name resolves to an allowed address", async () => {
    const provider = await startServer((_req, res) => res.end('{"akash":{"version":"0.6.0"}}'));
    const { fetchProvider } = setup();

    const response = await fetchProvider(`http://provider.test:${provider.port}/version`);

    expect(await response.json()).toEqual({ akash: { version: "0.6.0" } });
    expect(provider.hits).toEqual(["/version"]);
  });

  it("does not follow a redirect", async () => {
    const target = await startServer((_req, res) => res.end("{}"));
    const provider = await startServer((_req, res) => res.writeHead(302, { location: `${target.url}/internal` }).end());
    const { fetchProvider } = setup();

    await expect(fetchProvider(`${provider.url}/version`)).rejects.toThrow();
    expect(target.hits).toEqual([]);
  });

  it("stops reading a body larger than the limit", async () => {
    const provider = await startServer((_req, res) => res.end("x".repeat(11)));
    const { fetchProvider } = setup({ maxResponseBytes: 10 });

    const response = await fetchProvider(`${provider.url}/status`);

    await expect(response.text()).rejects.toThrow("Response body is larger than 10 bytes");
  });

  it("reads a body of exactly the limit", async () => {
    const provider = await startServer((_req, res) => res.end("x".repeat(10)));
    const { fetchProvider } = setup({ maxResponseBytes: 10 });

    const response = await fetchProvider(`${provider.url}/status`);

    await expect(response.text()).resolves.toBe("x".repeat(10));
  });

  it("counts the body after decompression", async () => {
    const compressed = gzipSync("x".repeat(1000));
    const provider = await startServer((_req, res) => res.writeHead(200, { "content-encoding": "gzip" }).end(compressed));
    const { fetchProvider } = setup({ maxResponseBytes: compressed.byteLength * 2 });

    const response = await fetchProvider(`${provider.url}/status`);

    await expect(response.text()).rejects.toThrow("Response body is larger than");
  });

  it("keeps the status, status text and headers of the response", async () => {
    const provider = await startServer((_req, res) => res.writeHead(503, "Busy", { "content-type": "application/json" }).end("{}"));
    const { fetchProvider } = setup();

    const response = await fetchProvider(`${provider.url}/version`);

    expect(response.status).toBe(503);
    expect(response.statusText).toBe("Busy");
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("returns a response without a body as is", async () => {
    const provider = await startServer((_req, res) => res.writeHead(204).end());
    const { fetchProvider } = setup();

    const response = await fetchProvider(`${provider.url}/version`);

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  function setup(input: { maxResponseBytes?: number } = {}) {
    const resolveTestHostToLoopback = (
      hostname: string,
      options: dns.LookupAllOptions,
      callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
    ) => (hostname === "provider.test" ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : dns.lookup(hostname, options, callback));
    const lookup = createForbidPrivateNetworkLookup(resolveTestHostToLoopback, new BlockList());
    const fetchProvider = createProviderFetch({ lookup, maxResponseBytes: input.maxResponseBytes });

    return { fetchProvider };
  }
});

async function startServer(handler: http.RequestListener) {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? "");
    handler(req, res);
  });

  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));

  const { port } = server.address() as AddressInfo;

  return { url: `http://127.0.0.1:${port}`, port, hits };
}

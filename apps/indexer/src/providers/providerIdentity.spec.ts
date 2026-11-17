import dns from "node:dns";
import http from "node:http";
import net, { type AddressInfo, BlockList } from "node:net";
import { describe, expect, it, onTestFinished } from "vitest";

import { createProviderFetch } from "@src/shared/utils/fetch";
import { createForbidPrivateNetworkLookup } from "@src/shared/utils/private-network";
import { assertEndpointNotOwnedByAnotherProvider, ProviderIdentityMismatchError } from "./providerIdentity";

const OWNER = "akash1lsqphmdf25rdm87zuhekeydv9pvtdzuqmwxlqg";
const OTHER_OWNER = "akash172k755dd82elslzcgkgtk3ux5ytdqvx5wq2a98";

describe(assertEndpointNotOwnedByAnotherProvider.name, () => {
  it("accepts an endpoint that answers as the provider itself", async () => {
    const endpoint = await startServer((_req, res) => res.end(JSON.stringify({ address: OWNER })));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
    expect(endpoint.hits).toEqual(["/address"]);
  });

  it("rejects an endpoint that answers as another provider", async () => {
    const endpoint = await startServer((_req, res) => res.end(JSON.stringify({ address: OTHER_OWNER })));
    const { assertIdentity } = setup();

    const error = await assertIdentity(endpoint.hostUri).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderIdentityMismatchError);
    expect(error).toMatchObject({
      name: "ProviderIdentityMismatchError",
      hostUri: endpoint.hostUri,
      owner: OWNER,
      reportedOwner: OTHER_OWNER,
      message: `Provider endpoint ${endpoint.hostUri} answers as ${OTHER_OWNER}, not ${OWNER}`
    });
  });

  it("accepts an endpoint that does not serve its address", async () => {
    const endpoint = await startServer((_req, res) => res.writeHead(404).end(JSON.stringify({ address: OTHER_OWNER })));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
  });

  it("accepts an address response that is not JSON", async () => {
    const endpoint = await startServer((_req, res) => res.end(OTHER_OWNER));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
  });

  it("accepts an address response without a textual address", async () => {
    const endpoint = await startServer((_req, res) => res.end(JSON.stringify({ address: [OTHER_OWNER] })));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
  });

  it("accepts a JSON null address response", async () => {
    const endpoint = await startServer((_req, res) => res.end("null"));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
  });

  it("accepts an address that is not an account", async () => {
    const endpoint = await startServer((_req, res) => res.end(JSON.stringify({ address: `gateway-${OTHER_OWNER}` })));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
  });

  it("accepts an address that only starts with another account", async () => {
    const endpoint = await startServer((_req, res) => res.end(JSON.stringify({ address: `${OTHER_OWNER}0` })));
    const { assertIdentity } = setup();

    await expect(assertIdentity(endpoint.hostUri)).resolves.toBeUndefined();
  });

  it("fails when the endpoint does not answer in time", async () => {
    const endpoint = await startServer(() => undefined);
    const { assertIdentity } = setup({ timeoutMs: 100 });

    await expect(assertIdentity(endpoint.hostUri)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("fails when the endpoint refuses the connection", async () => {
    const port = await findClosedPort();
    const { assertIdentity } = setup();

    await expect(assertIdentity(`http://provider.test:${port}`)).rejects.toThrow();
  });

  it("refuses a private address without dialing it", async () => {
    const endpoint = await startServer((_req, res) => res.end(JSON.stringify({ address: OWNER })));

    await expect(
      assertEndpointNotOwnedByAnotherProvider({ owner: OWNER, hostUri: `http://127.0.0.1:${endpoint.port}`, timeoutMs: 1_000 })
    ).rejects.toMatchObject({ code: "EFORBIDDEN" });
    expect(endpoint.hits).toEqual([]);
  });

  function setup(input: { timeoutMs?: number } = {}) {
    const resolveTestHostToLoopback = (
      hostname: string,
      options: dns.LookupAllOptions,
      callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
    ) => (hostname === "provider.test" ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : dns.lookup(hostname, options, callback));
    const fetchProvider = createProviderFetch({ lookup: createForbidPrivateNetworkLookup(resolveTestHostToLoopback, new BlockList()) });
    const assertIdentity = (hostUri: string) =>
      assertEndpointNotOwnedByAnotherProvider({ owner: OWNER, hostUri, timeoutMs: input.timeoutMs ?? 2_000, fetchProvider });

    return { assertIdentity };
  }
});

async function startServer(handler: http.RequestListener) {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? "");
    handler(req, res);
  });

  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => {
    server.closeAllConnections();
    return new Promise<void>(resolve => server.close(() => resolve()));
  });

  const { port } = server.address() as AddressInfo;

  return { hostUri: `http://provider.test:${port}`, port, hits };
}

async function findClosedPort() {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>(resolve => server.close(() => resolve()));

  return port;
}

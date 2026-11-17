import { certificateManager } from "@akashnetwork/chain-sdk";
import dns from "node:dns";
import net, { type AddressInfo, BlockList } from "node:net";
import tls from "node:tls";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { createForbidPrivateNetworkLookup } from "@src/shared/utils/private-network";
import { assertEndpointNotOwnedByAnotherProvider, ProviderIdentityMismatchError } from "./providerIdentity";

const OWNER = "akash1lsqphmdf25rdm87zuhekeydv9pvtdzuqmwxlqg";
const OTHER_OWNER = "akash172k755dd82elslzcgkgtk3ux5ytdqvx5wq2a98";

describe(assertEndpointNotOwnedByAnotherProvider.name, () => {
  it("accepts an endpoint that presents the provider's own certificate", async () => {
    const endpoint = await startTlsServer({ commonName: OWNER });
    const { assertIdentity } = setup();

    await expect(assertIdentity(`https://provider.test:${endpoint.port}`)).resolves.toBeUndefined();
  });

  it("rejects an endpoint that presents another provider's certificate", async () => {
    const endpoint = await startTlsServer({ commonName: OTHER_OWNER });
    const { assertIdentity } = setup();
    const url = `https://provider.test:${endpoint.port}`;

    const error = await assertIdentity(url).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderIdentityMismatchError);
    expect(error).toMatchObject({
      name: "ProviderIdentityMismatchError",
      endpoint: url,
      owner: OWNER,
      presentedOwner: OTHER_OWNER,
      message: `Provider endpoint ${url} presents the certificate of ${OTHER_OWNER}, not ${OWNER}`
    });
  });

  it("accepts an endpoint whose certificate names a host rather than an account", async () => {
    const endpoint = await startTlsServer({ commonName: "provider.test" });
    const { assertIdentity } = setup();

    await expect(assertIdentity(`https://provider.test:${endpoint.port}`)).resolves.toBeUndefined();
  });

  it("accepts a certificate whose name only contains another account", async () => {
    const endpoint = await startTlsServer({ commonName: `gateway-${OTHER_OWNER}` });
    const { assertIdentity } = setup();

    await expect(assertIdentity(`https://provider.test:${endpoint.port}`)).resolves.toBeUndefined();
  });

  it("asks for the endpoint's host name during the handshake", async () => {
    const endpoint = await startTlsServer({ commonName: OWNER });
    const { assertIdentity } = setup();

    await assertIdentity(`https://provider.test:${endpoint.port}`);

    expect(endpoint.serverNames).toEqual(["provider.test"]);
  });

  it("sends no host name to an endpoint addressed by IP", async () => {
    const endpoint = await startTlsServer({ commonName: OWNER });
    const { assertIdentity } = setup();

    await assertIdentity(`https://127.0.0.1:${endpoint.port}`);

    expect(endpoint.connections).toHaveLength(1);
    expect(endpoint.serverNames).toEqual([]);
  });

  it("reaches an endpoint addressed by an IPv6 literal", async () => {
    const endpoint = await startTlsServer({ commonName: OTHER_OWNER, host: "::1" });
    const { assertIdentity } = setup();

    await expect(assertIdentity(`https://[::1]:${endpoint.port}`)).rejects.toBeInstanceOf(ProviderIdentityMismatchError);
  });

  it("fails when the endpoint does not finish the handshake in time", async () => {
    const endpoint = await startSilentServer();
    const { assertIdentity } = setup({ timeoutMs: 100 });

    await expect(assertIdentity(`https://provider.test:${endpoint.port}`)).rejects.toThrow(
      `Timed out reading the certificate of https://provider.test:${endpoint.port}`
    );
  });

  it("leaves no deadline pending once the connection closes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => void vi.useRealTimers());
    const endpoint = await startTlsServer({ commonName: OWNER });
    const { assertIdentity } = setup();

    await assertIdentity(`https://provider.test:${endpoint.port}`);

    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(0));
  });

  it("fails when the endpoint refuses the connection", async () => {
    const port = await findClosedPort();
    const { assertIdentity } = setup();

    await expect(assertIdentity(`https://provider.test:${port}`)).rejects.toMatchObject({ code: "ECONNREFUSED" });
  });

  it("refuses a private address without dialing it", async () => {
    const endpoint = await startTlsServer({ commonName: OWNER });

    await expect(
      assertEndpointNotOwnedByAnotherProvider({ owner: OWNER, endpoint: `https://127.0.0.1:${endpoint.port}`, timeoutMs: 1_000 })
    ).rejects.toMatchObject({ code: "EFORBIDDEN" });
    expect(endpoint.connections).toEqual([]);
  });

  function setup(input: { timeoutMs?: number } = {}) {
    const resolveTestHostToLoopback = (
      hostname: string,
      options: dns.LookupAllOptions,
      callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
    ) => (hostname === "provider.test" ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : dns.lookup(hostname, options, callback));
    const lookup = createForbidPrivateNetworkLookup(resolveTestHostToLoopback, new BlockList());
    const assertIdentity = (endpoint: string) =>
      assertEndpointNotOwnedByAnotherProvider({ owner: OWNER, endpoint, timeoutMs: input.timeoutMs ?? 2_000, lookup });

    return { assertIdentity };
  }
});

async function startTlsServer(input: { commonName: string; host?: string }) {
  const { cert, privateKey } = await certificateManager.generatePEM(input.commonName);
  const context = tls.createSecureContext({ cert, key: privateKey });
  const serverNames: string[] = [];
  const server = tls.createServer({
    cert,
    key: privateKey,
    SNICallback: (serverName, callback) => {
      serverNames.push(serverName);
      callback(null, context);
    }
  });
  const { port, connections } = await listen(server, input.host ?? "127.0.0.1");

  return { port, connections, serverNames };
}

async function startSilentServer() {
  return listen(net.createServer(), "127.0.0.1");
}

async function findClosedPort() {
  const server = net.createServer();
  const port = await new Promise<number>(resolve => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));
  await new Promise<void>(resolve => server.close(() => resolve()));

  return port;
}

async function listen(server: net.Server, host: string) {
  const sockets: net.Socket[] = [];
  server.on("connection", socket => sockets.push(socket));
  await new Promise<void>(resolve => server.listen(0, host, resolve));
  onTestFinished(() => {
    sockets.forEach(socket => socket.destroy());
    return new Promise<void>(resolve => server.close(() => resolve()));
  });

  return { port: (server.address() as AddressInfo).port, connections: sockets };
}

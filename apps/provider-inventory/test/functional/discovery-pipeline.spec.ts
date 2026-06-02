import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { container, Lifecycle } from "tsyringe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import { CHAIN_SDK } from "@src/providers/chain-sdk.provider";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import { ProviderStreamFactory } from "@src/services/provider-stream-factory/provider-stream-factory.sevice";
import { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ClusterState, NodeState } from "@src/types/inventory.types";
import { testDb } from "../setup-functional-tests";

describe("DiscoveryScheduler pipeline", () => {
  beforeEach(async () => {
    await testDb.truncate();
  });

  it("writes a row and opens a stream when a brand-new provider appears", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { openedHosts, getProviderFromDb: readRow, scheduler } = setup({ providers: [provider] });

    await scheduler.discoverProviders();

    const row = await readRow("a");
    expect(row).toMatchObject({ owner: "a", host_uri: "https://a:8443" });
    expect(openedHosts).toContain("https://a:8443");

    scheduler.dispose();
  });

  it("closes the old stream and opens a new one when the provider's hostUri changes", async () => {
    const before = createProvider({ owner: "a", hostUri: "https://old:8443" });
    const after = createProvider({ owner: "a", hostUri: "https://new:8443" });
    const { scheduler, abortedHosts, openedHosts, lifecycle, setProviders, queueStreamMessages } = setup({ providers: [before] });
    queueStreamMessages("https://old:8443", [emptyClusterState()]);
    queueStreamMessages("https://new:8443", [emptyClusterState()]);

    await scheduler.discoverProviders();
    setProviders([after]);
    await scheduler.discoverProviders();
    lifecycle.shutdown();

    expect(abortedHosts).toContain("https://old:8443");
    expect(openedHosts).toEqual(["https://old:8443", "https://new:8443"]);
  });

  it("deletes the row and aborts the stream when the provider is removed from chain", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { scheduler, getProviderFromDb: readRow, abortedHosts, lifecycle, setProviders } = setup({ providers: [provider] });

    await scheduler.discoverProviders();
    expect(await readRow("a")).toBeDefined();

    setProviders([]);
    await scheduler.discoverProviders();
    lifecycle.shutdown();

    expect(await readRow("a")).toBeUndefined();
    expect(abortedHosts).toContain("https://a:8443");
  });

  it("propagates inventory writes from stream messages into the database", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { scheduler, getProviderFromDb: readRow, queueStreamMessages, lifecycle } = setup({ providers: [provider] });
    queueStreamMessages("https://a:8443", [
      {
        nodes: [
          buildNode({
            name: "n1",
            cpu: { allocatable: 4000n, allocated: 0n },
            memory: { allocatable: 8_000_000_000n, allocated: 0n },
            ephemeralStorage: { allocatable: 100_000_000_000n, allocated: 0n }
          })
        ],
        storage: Object.create(null)
      }
    ]);

    await scheduler.discoverProviders();
    await vi.waitFor(async () => {
      const current = await readRow("a");
      expect(current).toMatchObject({ is_online: true, total_available_cpu: 4000n });
    });
    lifecycle.shutdown();
  });

  it("swallows poller errors and leaves prior state intact", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { scheduler, getProviderFromDb: readRow, setPollError, lifecycle } = setup({ providers: [provider] });

    await scheduler.discoverProviders();
    expect(await readRow("a")).toBeDefined();

    setPollError(new Error("chain RPC unavailable"));
    await scheduler.discoverProviders();
    lifecycle.shutdown();

    expect(await readRow("a")).toBeDefined();
  });

  function setup(input: { providers?: ChainProvider[] }) {
    const testContainer = container.createChildContainer();

    const openedHosts: string[] = [];
    const abortedHosts: string[] = [];
    const queuedMessages = new Map<string, ClusterState[]>();
    let pollError: Error | null = null;
    let providers: ChainProvider[] = input.providers ?? [];

    const chainSDK = mockDeep<ChainNodeWebSDK>();
    chainSDK.akash.provider.v1beta4.getProviders.mockImplementation(() => {
      if (pollError) return Promise.reject(pollError);
      return Promise.resolve({
        providers: providers.map(p => ({ owner: p.owner, hostUri: p.hostUri, attributes: p.selfAttributes })),
        pagination: { nextKey: new Uint8Array(0) }
      } as unknown as Awaited<ReturnType<ChainNodeWebSDK["akash"]["provider"]["v1beta4"]["getProviders"]>>);
    });
    chainSDK.akash.audit.v1.getAllProvidersAttributes.mockImplementation(() =>
      Promise.resolve({ providers: [] } as unknown as Awaited<ReturnType<ChainNodeWebSDK["akash"]["audit"]["v1"]["getAllProvidersAttributes"]>>)
    );

    const streamFactory = mock<ProviderStreamFactory>();
    streamFactory.disposeProvider.mockResolvedValue();
    streamFactory.openStatusStream.mockImplementation((provider: ChainProvider, signal: AbortSignal) => {
      openedHosts.push(provider.hostUri);
      signal.addEventListener("abort", () => abortedHosts.push(provider.hostUri), { once: true });
      const messages = queuedMessages.get(provider.hostUri) ?? [];
      queuedMessages.delete(provider.hostUri);
      return makeStream(messages, signal);
    });

    testContainer.register(CHAIN_SDK, { useValue: chainSDK });
    testContainer.register(ProviderStreamFactory, { useValue: streamFactory });
    testContainer.register(ProviderInventoryRepository, { useClass: ProviderInventoryRepository }, { lifecycle: Lifecycle.ContainerScoped });
    testContainer.register(ChainProviderPollerService, { useClass: ChainProviderPollerService }, { lifecycle: Lifecycle.ContainerScoped });
    testContainer.register(StreamLifecycleManagerService, { useClass: StreamLifecycleManagerService }, { lifecycle: Lifecycle.ContainerScoped });
    testContainer.register(DiscoverySchedulerService, { useClass: DiscoverySchedulerService }, { lifecycle: Lifecycle.ContainerScoped });

    const scheduler = testContainer.resolve(DiscoverySchedulerService);
    const lifecycle = testContainer.resolve(StreamLifecycleManagerService);
    const pg = testContainer.resolve(PG_CLIENT);

    return {
      lifecycle,
      openedHosts,
      abortedHosts,
      scheduler,
      async getProviderFromDb(owner: string): Promise<Record<string, unknown> | undefined> {
        const [row] = await pg`SELECT * FROM provider_inventory WHERE owner = ${owner}`;
        return row;
      },
      queueStreamMessages(hostUri: string, messages: ClusterState[]) {
        queuedMessages.set(hostUri, messages);
      },
      setPollError(error: Error | null) {
        pollError = error;
      },
      setProviders(next: ChainProvider[]) {
        providers = next;
      }
    };
  }
});

function createProvider(overrides: Partial<ChainProvider> & Pick<ChainProvider, "owner" | "hostUri">): ChainProvider {
  return {
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}

function emptyClusterState(): ClusterState {
  return { nodes: [], storage: Object.create(null) };
}

function buildNode(overrides?: Partial<NodeState>): NodeState {
  return {
    name: "node-1",
    cpu: { allocatable: 0n, allocated: 0n },
    memory: { allocatable: 0n, allocated: 0n },
    ephemeralStorage: { allocatable: 0n, allocated: 0n },
    gpu: { quantity: { allocatable: 0n, allocated: 0n }, info: [] },
    storageClasses: [],
    cpus: [],
    ...overrides
  };
}

function makeStream(messages: ClusterState[], signal: AbortSignal): AsyncIterable<ClusterState> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next(): Promise<IteratorResult<ClusterState>> {
          if (signal.aborted) return { done: true, value: undefined };
          if (index < messages.length) {
            return { done: false, value: messages[index++] };
          }
          return new Promise<IteratorResult<ClusterState>>(resolve => {
            const onAbort = () => resolve({ done: true, value: undefined });
            signal.addEventListener("abort", onAbort, { once: true });
          });
        }
      };
    }
  };
}

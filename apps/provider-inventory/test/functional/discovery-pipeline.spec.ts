import { container, Lifecycle } from "tsyringe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChainQueryClient } from "@src/providers/chain-query.provider";
import { CHAIN_QUERY_CLIENT } from "@src/providers/chain-query.provider";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import { PROVIDER_STREAM_FACTORY } from "@src/providers/provider-stream.provider";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
import type { ChainProvider } from "@src/types/chain-provider";
import type { StreamStatusMessage } from "@src/types/stream-status";
import { testDb } from "../setup-functional-tests";

describe("DiscoveryScheduler pipeline (functional)", () => {
  beforeEach(async () => {
    await testDb.truncate();
  });

  it("writes a row and opens a stream when a brand-new provider appears", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { runTick, openedHosts, readRow } = setup({ providers: [provider] });

    await runTick();

    const row = await readRow("a");
    expect(row).toMatchObject({ owner: "a", host_uri: "https://a:8443", created_height: 100n });
    expect(openedHosts).toContain("https://a:8443");
  });

  it("closes the old stream and opens a new one when the provider's hostUri changes", async () => {
    const before = createProvider({ owner: "a", hostUri: "https://old:8443" });
    const after = createProvider({ owner: "a", hostUri: "https://new:8443" });
    const { runTick, abortedHosts, openedHosts, lifecycle, setProviders } = setup({ providers: [before] });

    await runTick();
    setProviders([after]);
    await runTick();
    lifecycle.shutdown();

    expect(abortedHosts).toContain("https://old:8443");
    expect(openedHosts).toEqual(["https://old:8443", "https://new:8443"]);
  });

  it("deletes the row and aborts the stream when the provider is removed from chain", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { runTick, readRow, abortedHosts, lifecycle, setProviders } = setup({ providers: [provider] });

    await runTick();
    expect(await readRow("a")).toBeDefined();

    setProviders([]);
    await runTick();
    lifecycle.shutdown();

    expect(await readRow("a")).toBeUndefined();
    expect(abortedHosts).toContain("https://a:8443");
  });

  it("propagates inventory writes from stream messages into the database", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { runTick, readRow, queueStreamMessages, lifecycle } = setup({ providers: [provider] });
    queueStreamMessages("https://a:8443", [
      {
        nodes: [
          {
            name: "n1",
            cpuAvailable: 4000,
            memoryAvailable: 8_000_000_000,
            gpus: [],
            ephStorageAvailable: 100_000_000_000,
            persistentStorage: []
          }
        ],
        storage: []
      }
    ]);

    await runTick();
    await vi.waitFor(async () => {
      const current = await readRow("a");
      expect(current).toMatchObject({ is_online: true, total_available_cpu: 4000n });
    });
    lifecycle.shutdown();
  });

  it("swallows poller errors and leaves prior state intact", async () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const { runTick, readRow, setPollError, lifecycle } = setup({ providers: [provider] });

    await runTick();
    expect(await readRow("a")).toBeDefined();

    setPollError(new Error("chain RPC unavailable"));
    await runTick();
    lifecycle.shutdown();

    expect(await readRow("a")).toBeDefined();
  });

  function setup(input: { providers?: ChainProvider[] }) {
    const testContainer = container.createChildContainer();

    const openedHosts: string[] = [];
    const abortedHosts: string[] = [];
    const queuedMessages = new Map<string, StreamStatusMessage[]>();
    let pollError: Error | null = null;
    let providers: ChainProvider[] = input.providers ?? [];

    const chainClient = mock<ChainQueryClient>();
    chainClient.getProviders.mockImplementation(() => {
      if (pollError) return Promise.reject(pollError);
      return Promise.resolve(
        providers.map(p => ({
          owner: p.owner,
          hostUri: p.hostUri,
          createdHeight: p.createdHeight,
          attributes: p.selfAttributes
        }))
      );
    });
    chainClient.getAllProvidersAttributes.mockImplementation(() => Promise.resolve(providers.map(p => ({ owner: p.owner, attributes: p.signedAttributes }))));

    const streamFactory = mock<ProviderStreamFactory>();
    streamFactory.openStatusStream.mockImplementation((hostUri: string, signal: AbortSignal) => {
      openedHosts.push(hostUri);
      signal.addEventListener("abort", () => abortedHosts.push(hostUri), { once: true });
      const messages = queuedMessages.get(hostUri) ?? [];
      queuedMessages.delete(hostUri);
      return makeStream(messages, signal);
    });

    testContainer.register(CHAIN_QUERY_CLIENT, { useValue: chainClient });
    testContainer.register(PROVIDER_STREAM_FACTORY, { useValue: streamFactory });
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
      async runTick(): Promise<void> {
        await scheduler.discoverProviders();
      },
      async readRow(owner: string): Promise<Record<string, unknown> | undefined> {
        const [row] = await pg`SELECT * FROM provider_inventory WHERE owner = ${owner}`;
        return row;
      },
      queueStreamMessages(hostUri: string, messages: StreamStatusMessage[]) {
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
    createdHeight: 100n,
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}

function makeStream(messages: StreamStatusMessage[], signal: AbortSignal): AsyncIterable<StreamStatusMessage> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next(): Promise<IteratorResult<StreamStatusMessage>> {
          if (signal.aborted) return { done: true, value: undefined };
          if (index < messages.length) {
            return { done: false, value: messages[index++] };
          }
          return new Promise<IteratorResult<StreamStatusMessage>>(resolve => {
            const onAbort = () => resolve({ done: true, value: undefined });
            signal.addEventListener("abort", onAbort, { once: true });
          });
        }
      };
    }
  };
}

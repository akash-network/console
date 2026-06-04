import type { LoggerService } from "@akashnetwork/logging";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ClusterState, NodeState } from "@src/types/inventory";
import type { ProviderStreamFactory } from "../provider-stream-factory/provider-stream-factory.sevice";
import { StreamLifecycleManagerService } from "./stream-lifecycle-manager.service";

describe(StreamLifecycleManagerService.name, () => {
  describe("start", () => {
    it("opens a stream for the provider", async () => {
      const provider = createProvider();
      const { manager, streamFactory } = setup({ streams: { "https://p1:8443": "hang" } });

      manager.start(provider);

      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledWith(provider, expect.any(AbortSignal)));
    });

    it("calls updateInventory for each unique stream message", async () => {
      const provider = createProvider();
      const messages = [createCluster({ cpu: 1000n }), createCluster({ cpu: 2000n })];
      const { manager, writer } = setup({ streams: { "https://p1:8443": msgsThenHang(messages) } });

      manager.start(provider);

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
      manager.dispose();

      expect(writer.updateInventory).toHaveBeenCalledWith(provider, createCluster({ cpu: 1000n }));
      expect(writer.updateInventory).toHaveBeenCalledWith(provider, createCluster({ cpu: 2000n }));
    });
  });

  describe("stopAndDelete", () => {
    it("aborts the stream and deletes the row for a vanished provider", async () => {
      const provider = createProvider();
      const { manager, streamFactory, writer } = setup({ streams: { "https://p1:8443": "hang" } });
      manager.start(provider);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(1));
      const signal = captureSignal(streamFactory);

      await manager.stopAndDelete([provider.owner]);

      expect(signal.aborted).toBe(true);
      expect(writer.deleteByOwner).toHaveBeenCalledWith([provider.owner]);
    });

    it("still deletes the row even when no stream is active for that owner", async () => {
      const { manager, writer } = setup();

      await manager.stopAndDelete(["ghost"]);

      expect(writer.deleteByOwner).toHaveBeenCalledWith(["ghost"]);
    });
  });

  describe("restart", () => {
    it("aborts the existing stream and opens a new one on the new hostUri", async () => {
      const old = createProvider({ owner: "a", hostUri: "https://old:8443" });
      const updated = createProvider({ owner: "a", hostUri: "https://new:8443" });
      const { manager, streamFactory, writer } = setup({
        streams: { "https://old:8443": "hang", "https://new:8443": "hang" }
      });
      manager.start(old);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(1));
      const oldSignal = captureSignal(streamFactory, 0);

      manager.restart(updated);

      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2));
      expect(oldSignal.aborted).toBe(true);
      expect(streamFactory.openStatusStream).toHaveBeenLastCalledWith(updated, expect.any(AbortSignal));
      expect(streamFactory.disposeProvider).toHaveBeenCalledWith("https://old:8443");
      expect(streamFactory.disposeProvider).not.toHaveBeenCalledWith("https://new:8443");
      expect(writer.deleteByOwner).not.toHaveBeenCalled();
    });
  });

  describe("parent signal listener", () => {
    it("keeps the parent-signal abort listener while the stream is healthy", async () => {
      const parent = new AbortController();
      const removeSpy = vi.spyOn(parent.signal, "removeEventListener");
      const { manager, streamFactory } = setup({ streams: { "https://p1:8443": "hang" } });

      manager.start(createProvider(), parent.signal);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalled());
      await delay(50);

      expect(removeSpy).not.toHaveBeenCalled();
    });

    it("removes the parent-signal abort listener once the stream gives up", async () => {
      const parent = new AbortController();
      const addSpy = vi.spyOn(parent.signal, "addEventListener");
      const removeSpy = vi.spyOn(parent.signal, "removeEventListener");
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager } = setup({ streamFactory });

      manager.start(createProvider(), parent.signal);

      const handler = addSpy.mock.calls.find(([type]) => type === "abort")?.[1];
      await vi.waitFor(() => expect(removeSpy).toHaveBeenCalledWith("abort", handler), { timeout: 5000 });
    });

    it("removes the old listener and attaches a fresh one on restart without accumulating", async () => {
      const old = createProvider({ owner: "a", hostUri: "https://old:8443" });
      const updated = createProvider({ owner: "a", hostUri: "https://new:8443" });
      const parent = new AbortController();
      const addSpy = vi.spyOn(parent.signal, "addEventListener");
      const removeSpy = vi.spyOn(parent.signal, "removeEventListener");
      const { manager, streamFactory } = setup({ streams: { "https://old:8443": "hang", "https://new:8443": "hang" } });

      manager.start(old, parent.signal);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(1));
      const oldHandler = addSpy.mock.calls.filter(([type]) => type === "abort")[0][1];

      manager.restart(updated, parent.signal);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2));

      await vi.waitFor(() => expect(removeSpy).toHaveBeenCalledWith("abort", oldHandler));
      const abortAdds = addSpy.mock.calls.filter(([type]) => type === "abort");
      expect(abortAdds).toHaveLength(2);
      expect(removeSpy).not.toHaveBeenCalledWith("abort", abortAdds[1][1]);
    });
  });

  describe("getRegistry", () => {
    it("exposes a snapshot of active streams keyed by owner with hostUri", () => {
      const a = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const b = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager } = setup({ streams: { "https://a:8443": "hang", "https://b:8443": "hang" } });

      manager.start(a);
      manager.start(b);

      const registry = manager.getRegistry();
      expect(registry.size).toBe(2);
      expect(registry.get("a")).toEqual(expect.objectContaining({ hostUri: "https://a:8443" }));
      expect(registry.get("b")).toEqual(expect.objectContaining({ hostUri: "https://b:8443" }));
    });
  });

  describe("diff cache", () => {
    it("performs a single write when two consecutive identical messages arrive", async () => {
      const { manager, writer, logger } = setup({
        streams: { "https://p1:8443": msgsThenHang([createCluster({ cpu: 1000n }), createCluster({ cpu: 1000n })]) }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL" })));

      expect(writer.updateInventory).toHaveBeenCalledTimes(1);
    });

    it("writes again when any meaningful field differs", async () => {
      const { manager, writer } = setup({
        streams: {
          "https://p1:8443": msgsThenHang([createCluster({ cpu: 1000n }), createCluster({ cpu: 1001n })])
        }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
    });

    it("considers messages with reordered nodes equal", async () => {
      const nodeA = buildNode({ name: "node-a", cpu: { allocatable: 4000n, allocated: 0n } });
      const nodeB = buildNode({ name: "node-b", cpu: { allocatable: 2000n, allocated: 0n } });
      const first: ClusterState = { nodes: [nodeA, nodeB], storage: Object.create(null) };
      const reordered: ClusterState = { nodes: [nodeB, nodeA], storage: Object.create(null) };

      const { manager, writer, logger } = setup({
        streams: { "https://p1:8443": msgsThenHang([first, reordered]) }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL" })));

      expect(writer.updateInventory).toHaveBeenCalledTimes(1);
    });

    it("writes the first message even when it would later be cacheable", async () => {
      const message = createCluster();
      const { manager, writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([message]) }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(1));
    });

    it("does not cache a row when the write fails — next identical message retries", async () => {
      const { manager, writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([createCluster(), createCluster()]) }
      });
      writer.updateInventory.mockRejectedValueOnce(new Error("DB down"));
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
    });

    it("isolates caches across providers", async () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, writer, logger } = setup({
        streams: {
          "https://a:8443": msgsThenHang([createCluster({ cpu: 1000n }), createCluster({ cpu: 1000n })]),
          "https://b:8443": msgsThenHang([createCluster({ cpu: 1000n })])
        }
      });
      manager.start(providerA);
      manager.start(providerB);

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL", owner: "a" })));

      expect(writer.updateInventory).toHaveBeenCalledWith(providerA, createCluster({ cpu: 1000n }));
      expect(writer.updateInventory).toHaveBeenCalledWith(providerB, createCluster({ cpu: 1000n }));
      expect(writer.updateInventory).toHaveBeenCalledTimes(2);
    });
  });

  describe("update throttle", () => {
    it("coalesces a burst of updates within the window into a single write of the latest", async () => {
      const { manager, writer } = setup({ streams: { "https://p1:8443": leadThenBurst() }, throttleMs: 1000 });

      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledWith(createProvider(), createCluster({ cpu: 3000n })), {
        timeout: 3000
      });
      expect(writer.updateInventory).toHaveBeenCalledWith(createProvider(), createCluster({ cpu: 1000n }));
      expect(writer.updateInventory).not.toHaveBeenCalledWith(createProvider(), createCluster({ cpu: 2000n }));
      expect(writer.updateInventory).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("logs and continues when updateInventory throws", async () => {
      const messages = [createCluster({ cpu: 1000n }), createCluster({ cpu: 2000n })];
      const { manager, writer, logger } = setup({ streams: { "https://p1:8443": msgsThenHang(messages) } });
      writer.updateInventory.mockRejectedValueOnce(new Error("DB down"));
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: "akash1owner" }));
    });

    it("logs each failed attempt as STREAM_ATTEMPT_FAILED", async () => {
      let attempt = 0;
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => {
        attempt++;
        if (attempt === 1) return throwingStream(new Error("connection lost"));
        return msgsThenHang([createCluster()]);
      });
      const { manager, logger } = setup({ streamFactory });
      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_ATTEMPT_FAILED", owner: "akash1owner" })), {
        timeout: 5000
      });
    });
  });

  describe("markOffline dedup", () => {
    it("marks offline only once across consecutive failed attempts", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, writer, logger } = setup({ streamFactory });
      const countFailures = () => logger.warn.mock.calls.filter(([arg]) => (arg as { event?: string })?.event === "STREAM_ATTEMPT_FAILED").length;

      manager.start(createProvider());

      await vi.waitFor(() => expect(countFailures()).toBeGreaterThanOrEqual(3), { timeout: 5000 });

      await vi.waitFor(() => expect(writer.bulkMarkOffline).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(writer.bulkMarkOffline).toHaveBeenCalledWith(["akash1owner"]);
    });

    it("marks offline again after a provider recovers and then drops", async () => {
      let attempt = 0;
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => {
        attempt++;
        if (attempt === 1) return throwingStream(new Error("initial failure"));
        if (attempt === 2) return msgsThenThrow([createCluster()], new Error("dropped"));
        return throwingStream(new Error("still down"));
      });
      const { manager, writer } = setup({ streamFactory });

      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.bulkMarkOffline).toHaveBeenCalledTimes(2), { timeout: 5000 });
    });

    it("does not mark offline when the very first attempt is delivering messages", async () => {
      const { manager, writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([createCluster()]) }
      });

      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(1));
      expect(writer.bulkMarkOffline).not.toHaveBeenCalled();
    });
  });

  describe("stale finalizer", () => {
    it("does not evict a replacement stream's registry entry when the old stream finishes", async () => {
      let resolveOldStream!: () => void;
      const oldStreamPromise = new Promise<IteratorResult<ClusterState>>(r => {
        resolveOldStream = () => r({ done: true, value: undefined });
      });
      const provider = createProvider();
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      let callCount = 0;
      streamFactory.openStatusStream.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            [Symbol.asyncIterator]() {
              return { next: () => oldStreamPromise };
            }
          };
        }
        return hangingStream();
      });
      const { manager } = setup({ streamFactory });

      manager.start(provider);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(1));
      await manager.stopAndDelete([provider.owner]);
      manager.start(provider);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2));

      expect(manager.getRegistry().get(provider.owner)).toEqual(expect.objectContaining({ hostUri: provider.hostUri }));

      resolveOldStream();
      await delay(20);

      expect(manager.getRegistry().get(provider.owner)).toEqual(expect.objectContaining({ hostUri: provider.hostUri }));
    });
  });

  describe("shutdown", () => {
    it("aborts all active streams", async () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, streamFactory } = setup({ streams: { "https://a:8443": "hang", "https://b:8443": "hang" } });
      manager.start(providerA);
      manager.start(providerB);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2));
      const signalA = captureSignal(streamFactory, 0);
      const signalB = captureSignal(streamFactory, 1);

      manager.shutdown();

      expect(signalA.aborted).toBe(true);
      expect(signalB.aborted).toBe(true);
    });

    it("clears the registry on shutdown", () => {
      const { manager } = setup({ streams: { "https://p1:8443": "hang" } });
      manager.start(createProvider());

      manager.shutdown();

      expect(manager.getRegistry().size).toBe(0);
    });

    it("does not log STREAM_RECONNECTING after shutdown when a scheduled retry timer fires", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, logger } = setup({ streamFactory });
      const countReconnects = () => logger.warn.mock.calls.filter(([arg]) => (arg as { event?: string })?.event === "STREAM_RECONNECTING").length;

      manager.start(createProvider());
      await vi.waitFor(() => expect(countReconnects()).toBeGreaterThan(0), { timeout: 5000 });

      const before = countReconnects();
      manager.shutdown();
      await delay(100);

      expect(countReconnects()).toBe(before);
    });

    it("clears diff cache on shutdown", async () => {
      const { manager, streamFactory, writer } = setup({ streams: { "https://p1:8443": msgsThenHang([createCluster({ cpu: 1000n })]) } });
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(1));

      manager.shutdown();
      streamFactory.openStatusStream.mockReturnValue(msgsThenHang([createCluster({ cpu: 1000n })]));
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
    });
  });

  function setup(input?: {
    streams?: Record<string, AsyncIterable<ClusterState> | "hang">;
    streamFactory?: MockProxy<ProviderStreamFactory>;
    throttleMs?: number;
  }) {
    const streamFactory = input?.streamFactory ?? mock<ProviderStreamFactory>();
    streamFactory.disposeProvider.mockResolvedValue();
    const writer = mock<ProviderInventoryRepository>();
    writer.deleteByOwner.mockResolvedValue();
    writer.bulkMarkOffline.mockResolvedValue();
    writer.updateInventory.mockResolvedValue();
    const logger = mock<LoggerService>();
    const loggerFactory: LoggerFactory = () => logger;
    const config = mock<EnvConfig>({
      MAX_CONCURRENT_STREAM_CONNECTIONS: 100,
      STREAM_RECONNECT_INITIAL_DELAY_MS: 10,
      STREAM_RECONNECT_MAX_DELAY_MS: 50,
      STREAM_FIRST_MESSAGE_TIMEOUT_MS: 80,
      STREAM_UPDATE_THROTTLE_MS: input?.throttleMs ?? 0
    });

    if (!input?.streamFactory) {
      const streams = input?.streams ?? {};
      streamFactory.openStatusStream.mockImplementation((provider: ChainProvider, signal: AbortSignal) => {
        const value = streams[provider.hostUri];
        if (value === "hang") return hangingStream(signal);
        if (value) return value;
        return hangingStream(signal);
      });
    }

    const manager = new StreamLifecycleManagerService(streamFactory, writer, loggerFactory, config);

    return { manager, streamFactory, writer, logger };
  }
});

function createProvider(overrides?: Partial<ChainProvider>): ChainProvider {
  return {
    owner: "akash1owner",
    hostUri: "https://p1:8443",
    selfAttributes: [],
    signedAttributes: [],
    auditedBy: [],
    ...overrides
  };
}

function createCluster(overrides?: { cpu?: bigint }): ClusterState {
  return {
    nodes: [
      buildNode({
        name: "node-1",
        cpu: { allocatable: overrides?.cpu ?? 4000n, allocated: 0n },
        memory: { allocatable: 8_000_000_000n, allocated: 0n },
        ephemeralStorage: { allocatable: 100_000_000_000n, allocated: 0n }
      })
    ],
    storage: Object.create(null)
  };
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

async function* msgsThenHang(messages: ClusterState[]): AsyncGenerator<ClusterState> {
  for (const msg of messages) yield msg;
  await new Promise<never>(() => undefined);
}

async function* throwingStream(error: Error): AsyncGenerator<ClusterState> {
  yield* [];
  throw error;
}

async function* msgsThenThrow(messages: ClusterState[], error: Error): AsyncGenerator<ClusterState> {
  for (const msg of messages) yield msg;
  throw error;
}

// Emits a leading message, then — after it has been consumed — a rapid burst within the throttle
// window, so the burst coalesces to its latest value (3000) while the leading value (1000) survives.
async function* leadThenBurst(): AsyncGenerator<ClusterState> {
  yield createCluster({ cpu: 1000n });
  await delay(20);
  yield createCluster({ cpu: 2000n });
  yield createCluster({ cpu: 3000n });
  await new Promise<never>(() => undefined);
}

function hangingStream(signal?: AbortSignal): AsyncIterable<ClusterState> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          new Promise<IteratorResult<ClusterState>>((_, reject) => {
            if (!signal) return;
            if (signal.aborted) reject(new DOMException("aborted", "AbortError"));
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
          })
      };
    }
  };
}

function captureSignal(streamFactory: { openStatusStream: { mock: { calls: Array<[ChainProvider, AbortSignal]> } } }, callIndex?: number): AbortSignal {
  const idx = callIndex ?? streamFactory.openStatusStream.mock.calls.length - 1;
  return streamFactory.openStatusStream.mock.calls[idx][1];
}

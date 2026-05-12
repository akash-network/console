import type { LoggerService } from "@akashnetwork/logging";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import type { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProvider } from "@src/types/chain-provider";
import type { StreamStatusMessage } from "@src/types/stream-status";
import { StreamLifecycleManagerService } from "./stream-lifecycle-manager.service";

describe(StreamLifecycleManagerService.name, () => {
  describe("start", () => {
    it("opens a stream for the provider", () => {
      const provider = createProvider();
      const { manager, streamFactory } = setup({ streams: { "https://p1:8443": "hang" } });

      manager.start(provider);

      expect(streamFactory.openStatusStream).toHaveBeenCalledWith(provider.hostUri, expect.any(AbortSignal));
    });

    it("calls updateInventory for each unique stream message", async () => {
      const provider = createProvider();
      const messages = [createMessage({ cpu: 1000 }), createMessage({ cpu: 2000 })];
      const { manager, writer } = setup({ streams: { "https://p1:8443": msgsThenHang(messages) } });

      manager.start(provider);

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
      expect(writer.updateInventory).toHaveBeenCalledWith(provider, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.updateInventory).toHaveBeenCalledWith(provider, expect.objectContaining({ totalAvailableCpu: 2000n }));
    });
  });

  describe("stopAndDelete", () => {
    it("aborts the stream and deletes the row for a vanished provider", async () => {
      const provider = createProvider();
      const { manager, streamFactory, writer } = setup({ streams: { "https://p1:8443": "hang" } });
      manager.start(provider);
      const signal = captureSignal(streamFactory);

      await manager.stopAndDelete(provider.owner);

      expect(signal.aborted).toBe(true);
      expect(writer.deleteByOwner).toHaveBeenCalledWith(provider.owner);
    });

    it("still deletes the row even when no stream is active for that owner", async () => {
      const { manager, writer } = setup();

      await manager.stopAndDelete("ghost");

      expect(writer.deleteByOwner).toHaveBeenCalledWith("ghost");
    });
  });

  describe("restart", () => {
    it("aborts the existing stream and opens a new one on the new hostUri", () => {
      const old = createProvider({ owner: "a", hostUri: "https://old:8443" });
      const updated = createProvider({ owner: "a", hostUri: "https://new:8443" });
      const { manager, streamFactory, writer } = setup({
        streams: { "https://old:8443": "hang", "https://new:8443": "hang" }
      });
      manager.start(old);
      const oldSignal = captureSignal(streamFactory, 0);

      manager.restart(updated);

      expect(oldSignal.aborted).toBe(true);
      expect(streamFactory.openStatusStream).toHaveBeenLastCalledWith("https://new:8443", expect.any(AbortSignal));
      expect(writer.deleteByOwner).not.toHaveBeenCalled();
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
      expect(registry.get("a")).toEqual({ hostUri: "https://a:8443" });
      expect(registry.get("b")).toEqual({ hostUri: "https://b:8443" });
    });
  });

  describe("diff cache", () => {
    it("performs a single write when two consecutive identical messages arrive", async () => {
      const message = createMessage({ cpu: 1000 });
      const { manager, writer, logger } = setup({
        streams: { "https://p1:8443": msgsThenHang([message, structuredClone(message)]) }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL" })));

      expect(writer.updateInventory).toHaveBeenCalledTimes(1);
    });

    it("writes again when any meaningful field differs", async () => {
      const { manager, writer } = setup({
        streams: {
          "https://p1:8443": msgsThenHang([createMessage({ cpu: 1000 }), createMessage({ cpu: 1001 })])
        }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
    });

    it("considers messages with reordered nodes/gpus/storage equal", async () => {
      const first: StreamStatusMessage = {
        nodes: [
          {
            name: "node-1",
            cpuAvailable: 4000,
            memoryAvailable: 8_000_000_000,
            gpus: [
              { vendor: "nvidia", model: "a100", available: 1 },
              { vendor: "amd", model: "mi300x", available: 2 }
            ],
            ephStorageAvailable: 100_000_000_000,
            persistentStorage: [
              { class: "beta2", available: 100 },
              { class: "beta3", available: 200 }
            ]
          },
          {
            name: "node-2",
            cpuAvailable: 2000,
            memoryAvailable: 4_000_000_000,
            gpus: [],
            ephStorageAvailable: 50_000_000_000,
            persistentStorage: []
          }
        ],
        storage: [
          { class: "beta2", available: 500 },
          { class: "beta3", available: 600 }
        ]
      };
      const reordered: StreamStatusMessage = {
        nodes: [
          first.nodes[1],
          {
            ...first.nodes[0],
            gpus: [...first.nodes[0].gpus].reverse(),
            persistentStorage: [...first.nodes[0].persistentStorage].reverse()
          }
        ],
        storage: [...first.storage].reverse()
      };

      const { manager, writer, logger } = setup({
        streams: { "https://p1:8443": msgsThenHang([first, reordered]) }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL" })));

      expect(writer.updateInventory).toHaveBeenCalledTimes(1);
    });

    it("writes the first message even when it would later be cacheable", async () => {
      const message = createMessage();
      const { manager, writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([message]) }
      });
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(1));
    });

    it("does not cache a row when the write fails — next identical message retries", async () => {
      const message = createMessage();
      const { manager, writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([message, structuredClone(message)]) }
      });
      writer.updateInventory.mockRejectedValueOnce(new Error("DB down"));
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
    });

    it("isolates caches across providers", async () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const messageA = createMessage({ cpu: 1000 });
      const messageB = createMessage({ cpu: 1000 });
      const { manager, writer, logger } = setup({
        streams: {
          "https://a:8443": msgsThenHang([messageA, structuredClone(messageA)]),
          "https://b:8443": msgsThenHang([messageB])
        }
      });
      manager.start(providerA);
      manager.start(providerB);

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL", owner: "a" })));

      expect(writer.updateInventory).toHaveBeenCalledWith(providerA, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.updateInventory).toHaveBeenCalledWith(providerB, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.updateInventory).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("logs and continues when updateInventory throws", async () => {
      const messages = [createMessage({ cpu: 1000 }), createMessage({ cpu: 2000 })];
      const { manager, writer, logger } = setup({ streams: { "https://p1:8443": msgsThenHang(messages) } });
      writer.updateInventory.mockRejectedValueOnce(new Error("DB down"));
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: "akash1owner" }));
    });

    it("logs each failed attempt as STREAM_ATTEMPT_FAILED", async () => {
      let attempt = 0;
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.openStatusStream.mockImplementation(() => {
        attempt++;
        if (attempt === 1) return throwingStream(new Error("connection lost"));
        return msgsThenHang([createMessage()]);
      });
      const { manager, logger } = setup({ streamFactory });
      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_ATTEMPT_FAILED", owner: "akash1owner" })));
    });
  });

  describe("stale finalizer", () => {
    it("does not evict a replacement stream's registry entry when the old stream finishes", async () => {
      let resolveOldStream!: () => void;
      const oldStreamPromise = new Promise<IteratorResult<StreamStatusMessage>>(r => {
        resolveOldStream = () => r({ done: true, value: undefined });
      });
      const provider = createProvider();
      const streamFactory = mock<ProviderStreamFactory>();
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
      await manager.stopAndDelete(provider.owner);
      manager.start(provider);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);
      expect(manager.getRegistry().get(provider.owner)).toEqual({ hostUri: provider.hostUri });

      resolveOldStream();
      await delay(20);

      expect(manager.getRegistry().get(provider.owner)).toEqual({ hostUri: provider.hostUri });
    });
  });

  describe("shutdown", () => {
    it("aborts all active streams", () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, streamFactory } = setup({ streams: { "https://a:8443": "hang", "https://b:8443": "hang" } });
      manager.start(providerA);
      manager.start(providerB);
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

    it("clears diff cache on shutdown", async () => {
      const stable = createMessage({ cpu: 1000 });
      const { manager, streamFactory, writer } = setup({ streams: { "https://p1:8443": msgsThenHang([stable]) } });
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(1));

      manager.shutdown();
      streamFactory.openStatusStream.mockReturnValue(msgsThenHang([stable]));
      manager.start(createProvider());

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(2));
    });
  });

  function setup(input?: { streams?: Record<string, AsyncIterable<StreamStatusMessage> | "hang">; streamFactory?: MockProxy<ProviderStreamFactory> }) {
    const streamFactory = input?.streamFactory ?? mock<ProviderStreamFactory>();
    const writer = mock<ProviderInventoryRepository>();
    writer.deleteByOwner.mockResolvedValue();
    writer.markOffline.mockResolvedValue();
    writer.updateInventory.mockResolvedValue();
    const logger = mock<LoggerService>();
    const loggerFactory: LoggerFactory = () => logger;
    const config = mock<EnvConfig>({
      STREAM_RECONNECT_INITIAL_DELAY_MS: 10,
      STREAM_RECONNECT_MAX_DELAY_MS: 50,
      STREAM_FIRST_MESSAGE_TIMEOUT_MS: 80
    });

    if (!input?.streamFactory) {
      const streams = input?.streams ?? {};
      streamFactory.openStatusStream.mockImplementation((hostUri: string, signal: AbortSignal) => {
        const value = streams[hostUri];
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
    createdHeight: 100n,
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}

function createMessage(overrides?: { cpu?: number }): StreamStatusMessage {
  return {
    nodes: [
      {
        name: "node-1",
        cpuAvailable: overrides?.cpu ?? 4000,
        memoryAvailable: 8_000_000_000,
        gpus: [],
        ephStorageAvailable: 100_000_000_000,
        persistentStorage: []
      }
    ],
    storage: []
  };
}

async function* msgsThenHang(messages: StreamStatusMessage[]): AsyncGenerator<StreamStatusMessage> {
  for (const msg of messages) yield msg;
  await new Promise<never>(() => undefined);
}

async function* throwingStream(error: Error): AsyncGenerator<StreamStatusMessage> {
  yield* [];
  throw error;
}

function hangingStream(signal?: AbortSignal): AsyncIterable<StreamStatusMessage> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          new Promise<IteratorResult<StreamStatusMessage>>((_, reject) => {
            if (!signal) return;
            if (signal.aborted) reject(new DOMException("aborted", "AbortError"));
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
          })
      };
    }
  };
}

function captureSignal(streamFactory: { openStatusStream: { mock: { calls: Array<[string, AbortSignal]> } } }, callIndex?: number): AbortSignal {
  const idx = callIndex ?? streamFactory.openStatusStream.mock.calls.length - 1;
  return streamFactory.openStatusStream.mock.calls[idx][1];
}

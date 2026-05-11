import type { LoggerService } from "@akashnetwork/logging";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import type { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import type { ChainProvider } from "@src/types/chain-provider";
import type { StreamStatusMessage } from "@src/types/stream-status";
import { StreamLifecycleManagerService } from "./stream-lifecycle-manager.service";

describe(StreamLifecycleManagerService.name, () => {
  describe("reconcile", () => {
    it("opens a stream for a new provider", async () => {
      const { streamFactory } = setup({ streams: { "https://p1:8443": "hang" } });

      expect(streamFactory.openStatusStream).toHaveBeenCalledWith("https://p1:8443", expect.any(AbortSignal));
    });

    it("calls upsertInventory for each unique stream message", async () => {
      const messages = [createMessage({ cpu: 1000 }), createMessage({ cpu: 2000 })];
      const { writer, providers } = setup({ streams: { "https://p1:8443": msgsThenHang(messages) } });

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(2));

      expect(writer.upsertInventory).toHaveBeenCalledWith(providers[0], expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.upsertInventory).toHaveBeenCalledWith(providers[0], expect.objectContaining({ totalAvailableCpu: 2000n }));
    });

    it("skips providers that already have an active stream", async () => {
      const { manager, streamFactory, providers } = setup({ streams: { "https://p1:8443": "hang" } });

      manager.reconcile(providers);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(1);
    });

    it("stops streams for providers absent from the new list", async () => {
      const { manager, streamFactory } = setup({ streams: { "https://p1:8443": "hang" } });
      const signal = captureSignal(streamFactory);

      manager.reconcile([]);

      expect(signal.aborted).toBe(true);
    });

    it("opens streams for new providers while stopping removed ones", async () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, streamFactory } = setup({
        providers: [providerA],
        streams: { "https://a:8443": "hang", "https://b:8443": "hang" }
      });
      const signal = captureSignal(streamFactory);

      manager.reconcile([providerB]);

      expect(signal.aborted).toBe(true);
      expect(streamFactory.openStatusStream).toHaveBeenCalledWith("https://b:8443", expect.any(AbortSignal));
    });
  });

  describe("diff cache", () => {
    it("performs a single write when two consecutive identical messages arrive", async () => {
      const message = createMessage({ cpu: 1000 });
      const { writer, logger } = setup({
        streams: { "https://p1:8443": msgsThenHang([message, structuredClone(message)]) }
      });

      await vi.waitFor(() =>
        expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL" }))
      );

      expect(writer.upsertInventory).toHaveBeenCalledTimes(1);
    });

    it("writes again when any meaningful field differs", async () => {
      const { writer } = setup({
        streams: {
          "https://p1:8443": msgsThenHang([createMessage({ cpu: 1000 }), createMessage({ cpu: 1001 })])
        }
      });

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(2));
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

      const { writer, logger } = setup({
        streams: { "https://p1:8443": msgsThenHang([first, reordered]) }
      });

      await vi.waitFor(() =>
        expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL" }))
      );

      expect(writer.upsertInventory).toHaveBeenCalledTimes(1);
    });

    it("writes the first message even when it would later be cacheable", async () => {
      const message = createMessage();
      const { writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([message]) }
      });

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(1));
    });

    it("does not cache a row when the write fails — next identical message retries", async () => {
      const message = createMessage();
      const { writer } = setup({
        streams: { "https://p1:8443": msgsThenHang([message, structuredClone(message)]) }
      });
      writer.upsertInventory.mockRejectedValueOnce(new Error("DB down"));

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(2));
    });

    it("isolates caches across providers", async () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const messageA = createMessage({ cpu: 1000 });
      const messageB = createMessage({ cpu: 1000 });
      const { writer, logger } = setup({
        providers: [providerA, providerB],
        streams: {
          "https://a:8443": msgsThenHang([messageA, structuredClone(messageA)]),
          "https://b:8443": msgsThenHang([messageB])
        }
      });

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(2));
      await vi.waitFor(() =>
        expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_MESSAGE_SKIPPED_IDENTICAL", owner: "a" }))
      );

      expect(writer.upsertInventory).toHaveBeenCalledWith(providerA, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.upsertInventory).toHaveBeenCalledWith(providerB, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.upsertInventory).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("logs and continues when upsertInventory throws", async () => {
      const messages = [createMessage({ cpu: 1000 }), createMessage({ cpu: 2000 })];
      const { writer, logger } = setup({ streams: { "https://p1:8443": msgsThenHang(messages) } });
      writer.upsertInventory.mockRejectedValueOnce(new Error("DB down"));

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(2));

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
      const { logger } = setup({ streamFactory });

      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_ATTEMPT_FAILED", owner: "akash1owner" }))
      );
    });
  });

  describe("stale finalizer", () => {
    it("does not remove a replacement stream when the old one finishes", async () => {
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
      const { manager } = setup({ streamFactory, providers: [provider] });

      manager.reconcile([]);
      manager.reconcile([provider]);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);

      resolveOldStream();
      await delay(20);

      manager.reconcile([provider]);
      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);
    });
  });

  describe("shutdown", () => {
    it("aborts all active streams", () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, streamFactory } = setup({
        providers: [providerA, providerB],
        streams: { "https://a:8443": "hang", "https://b:8443": "hang" }
      });
      const signalA = captureSignal(streamFactory, 0);
      const signalB = captureSignal(streamFactory, 1);

      manager.shutdown();

      expect(signalA.aborted).toBe(true);
      expect(signalB.aborted).toBe(true);
    });

    it("allows new streams after shutdown and re-reconcile", async () => {
      const { manager, streamFactory } = setup({ streams: { "https://p1:8443": "hang" } });

      manager.shutdown();
      streamFactory.openStatusStream.mockReturnValue(hangingStream());

      manager.reconcile([createProvider()]);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);
    });

    it("clears diff cache on shutdown", async () => {
      const stable = createMessage({ cpu: 1000 });
      const { manager, streamFactory, writer } = setup({ streams: { "https://p1:8443": msgsThenHang([stable]) } });

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(1));

      manager.shutdown();
      streamFactory.openStatusStream.mockReturnValue(msgsThenHang([stable]));
      manager.reconcile([createProvider()]);

      await vi.waitFor(() => expect(writer.upsertInventory).toHaveBeenCalledTimes(2));
    });
  });

  function setup(input?: {
    providers?: ChainProvider[];
    streams?: Record<string, AsyncIterable<StreamStatusMessage> | "hang">;
    streamFactory?: MockProxy<ProviderStreamFactory>;
  }) {
    const streamFactory = input?.streamFactory ?? mock<ProviderStreamFactory>();
    const writer = mock<ProviderInventoryWriterService>();
    const logger = mock<LoggerService>();
    const loggerFactory: LoggerFactory = () => logger;
    const providers = input?.providers ?? [createProvider()];
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
    manager.reconcile(providers);

    return { manager, streamFactory, writer, logger, providers };
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

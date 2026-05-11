import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ProviderStreamFactory } from "@src/providers/provider-stream.provider";
import type { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import type { ChainProvider } from "@src/types/chain-provider";
import type { StreamStatusMessage } from "@src/types/stream-status";
import { StreamLifecycleManagerService } from "./stream-lifecycle-manager.service";

describe(StreamLifecycleManagerService.name, () => {
  describe("reconcile", () => {
    it("opens a stream for a new provider", async () => {
      const message = createMessage();
      const { streamFactory } = setup({
        streams: { "https://p1:8443": [message] }
      });

      expect(streamFactory.openStatusStream).toHaveBeenCalledWith("https://p1:8443", expect.any(AbortSignal));
    });

    it("calls upsertInventory for each stream message", async () => {
      const messages = [createMessage({ cpu: 1000 }), createMessage({ cpu: 2000 })];
      const { writer, providers } = setup({
        streams: { "https://p1:8443": messages }
      });

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledTimes(2);
      expect(writer.upsertInventory).toHaveBeenCalledWith(providers[0], expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.upsertInventory).toHaveBeenCalledWith(providers[0], expect.objectContaining({ totalAvailableCpu: 2000n }));
    });

    it("skips providers that already have an active stream", async () => {
      const { manager, streamFactory, providers } = setup({
        streams: { "https://p1:8443": [createMessage()] }
      });

      manager.reconcile(providers);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(1);
    });

    it("stops streams for providers absent from the new list", async () => {
      const signals: AbortSignal[] = [];
      const { manager, streamFactory } = setup({
        streams: { "https://p1:8443": "hang" }
      });
      signals.push(captureSignal(streamFactory));

      manager.reconcile([]);

      expect(signals[0].aborted).toBe(true);
    });

    it("opens streams for new providers while stopping removed ones", async () => {
      const signals: AbortSignal[] = [];
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, streamFactory } = setup({
        providers: [providerA],
        streams: { "https://a:8443": "hang", "https://b:8443": [createMessage()] }
      });
      signals.push(captureSignal(streamFactory));

      manager.reconcile([providerB]);

      expect(signals[0].aborted).toBe(true);
      expect(streamFactory.openStatusStream).toHaveBeenCalledWith("https://b:8443", expect.any(AbortSignal));
    });
  });

  describe("diff cache", () => {
    it("performs a single write when two consecutive identical messages arrive", async () => {
      const message = createMessage({ cpu: 1000 });
      const { writer } = setup({
        streams: { "https://p1:8443": [message, structuredClone(message)] }
      });

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledTimes(1);
    });

    it("writes again when any meaningful field differs", async () => {
      const { writer } = setup({
        streams: { "https://p1:8443": [createMessage({ cpu: 1000 }), createMessage({ cpu: 1001 })] }
      });

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledTimes(2);
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

      const { writer } = setup({
        streams: { "https://p1:8443": [first, reordered] }
      });

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledTimes(1);
    });

    it("writes the first message even when it would later be cacheable", async () => {
      const message = createMessage();
      const { writer } = setup({
        streams: { "https://p1:8443": [message] }
      });

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledTimes(1);
    });

    it("does not cache a row when the write fails — next identical message retries", async () => {
      const message = createMessage();
      const { writer } = setup({
        streams: { "https://p1:8443": [message, structuredClone(message)] }
      });
      writer.upsertInventory.mockRejectedValueOnce(new Error("DB down"));

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledTimes(2);
    });

    it("tracks skipped no-op messages via getStats", async () => {
      const message = createMessage();
      const { manager } = setup({
        streams: { "https://p1:8443": [message, structuredClone(message), structuredClone(message)] }
      });

      await flush();

      expect(manager.getStats().noopMessagesSkipped).toBe(2);
    });

    it("reports zero skipped messages when none have arrived", () => {
      const { manager } = setup({ streams: { "https://p1:8443": "hang" } });

      expect(manager.getStats().noopMessagesSkipped).toBe(0);
    });

    it("isolates caches across providers", async () => {
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const messageA = createMessage({ cpu: 1000 });
      const messageB = createMessage({ cpu: 1000 });
      const { writer } = setup({
        providers: [providerA, providerB],
        streams: {
          "https://a:8443": [messageA, structuredClone(messageA)],
          "https://b:8443": [messageB]
        }
      });

      await flush();

      expect(writer.upsertInventory).toHaveBeenCalledWith(providerA, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.upsertInventory).toHaveBeenCalledWith(providerB, expect.objectContaining({ totalAvailableCpu: 1000n }));
      expect(writer.upsertInventory).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("logs and continues when upsertInventory throws", async () => {
      const messages = [createMessage({ cpu: 1000 }), createMessage({ cpu: 2000 })];
      const { writer, logger } = setup({
        streams: { "https://p1:8443": messages }
      });
      writer.upsertInventory.mockRejectedValueOnce(new Error("DB down"));

      await flush();

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_PROVIDER_WRITE_ERROR", owner: "akash1owner" }));
      expect(writer.upsertInventory).toHaveBeenCalledTimes(2);
    });

    it("logs stream-level errors", async () => {
      const { logger } = setup({
        streams: { "https://p1:8443": new Error("connection lost") }
      });

      await flush();

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_ERROR", owner: "akash1owner" }));
    });

    it("does not log AbortError", async () => {
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      const { logger } = setup({
        streams: { "https://p1:8443": abortError }
      });

      await flush();

      expect(logger.error).not.toHaveBeenCalled();
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
      const writer = mock<ProviderInventoryWriterService>();
      const logger = mock<ReturnType<LoggerFactory>>();
      const loggerFactory: LoggerFactory = () => logger;

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

      const manager = new StreamLifecycleManagerService(streamFactory, writer, loggerFactory);
      manager.reconcile([provider]);

      manager.reconcile([]);
      manager.reconcile([provider]);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);

      resolveOldStream();
      await flush();

      manager.reconcile([provider]);
      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);
    });
  });

  describe("shutdown", () => {
    it("aborts all active streams", () => {
      const signals: AbortSignal[] = [];
      const providerA = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const providerB = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, streamFactory } = setup({
        providers: [providerA, providerB],
        streams: { "https://a:8443": "hang", "https://b:8443": "hang" }
      });
      signals.push(captureSignal(streamFactory, 0), captureSignal(streamFactory, 1));

      manager.shutdown();

      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(true);
    });

    it("allows new streams after shutdown and re-reconcile", async () => {
      const { manager, streamFactory } = setup({
        streams: { "https://p1:8443": "hang" }
      });

      manager.shutdown();
      streamFactory.openStatusStream.mockReturnValue(hangingStream());

      manager.reconcile([createProvider()]);

      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);
    });
  });

  function setup(input?: { providers?: ChainProvider[]; streams?: Record<string, StreamStatusMessage[] | Error | "hang"> }) {
    const streamFactory = mock<ProviderStreamFactory>();
    const writer = mock<ProviderInventoryWriterService>();
    const logger = mock<ReturnType<LoggerFactory>>();
    const loggerFactory: LoggerFactory = () => logger;
    const providers = input?.providers ?? [createProvider()];

    const streams = input?.streams ?? {};
    streamFactory.openStatusStream.mockImplementation((hostUri: string) => {
      const value = streams[hostUri];
      if (value === "hang") return hangingStream();
      if (value instanceof Error) return throwingStream(value);
      if (Array.isArray(value)) return arrayStream(value);
      return arrayStream([]);
    });

    const manager = new StreamLifecycleManagerService(streamFactory, writer, loggerFactory);
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

async function* arrayStream(messages: StreamStatusMessage[]) {
  for (const msg of messages) {
    yield msg;
  }
}

async function* throwingStream(error: Error): AsyncGenerator<StreamStatusMessage> {
  yield* []; // satisfy require-yield
  throw error;
}

function hangingStream(): AsyncIterable<StreamStatusMessage> {
  return {
    [Symbol.asyncIterator]() {
      return { next: () => new Promise<IteratorResult<StreamStatusMessage>>(() => {}) };
    }
  };
}

function captureSignal(streamFactory: { openStatusStream: { mock: { calls: Array<[string, AbortSignal]> } } }, callIndex?: number): AbortSignal {
  const idx = callIndex ?? streamFactory.openStatusStream.mock.calls.length - 1;
  return streamFactory.openStatusStream.mock.calls[idx][1];
}

async function flush() {
  // setTimeout(0) fires after all pending microtasks (Promise callbacks, async generator yields) have drained
  await new Promise(resolve => setTimeout(resolve, 0));
}

import type { LoggerService } from "@akashnetwork/logging";
import { getEventListeners } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { DbDriver } from "@src/repositories/db-driver/db-driver";
import type { ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";
import type { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProvider, ChainProviderWithOfflineSince } from "@src/types/chain-provider";
import type { ClusterState, NodeState } from "@src/types/inventory";
import type { ProviderStreamFactory } from "../provider-stream-factory/provider-stream-factory.sevice";
import type { TimerService } from "../timer/timer.service";
import { StreamLifecycleManagerService } from "./stream-lifecycle-manager.service";

describe(StreamLifecycleManagerService.name, () => {
  beforeEach(() => {
    vi.useFakeTimers().setTimerTickMode("nextTimerAsync");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
      const { manager, streamFactory, writer } = setup({ streams: { "https://p1:8443": msgsThenHang([createCluster()]) } });
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
        streams: { "https://old:8443": msgsThenHang([createCluster()]), "https://new:8443": msgsThenHang([createCluster()]) }
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
      const { manager, streamFactory } = setup({ streams: { "https://p1:8443": msgsThenHang([createCluster()]) } });

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
      const { manager, streamFactory } = setup({
        streams: { "https://old:8443": msgsThenHang([createCluster()]), "https://new:8443": msgsThenHang([createCluster()]) }
      });

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
      expect(writer.bulkMarkOffline).toHaveBeenCalledWith(["akash1owner"], expect.any(Date));
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

  describe("incident tracking", () => {
    it("opens an incident after all retries are exhausted", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, incidents, logger } = setup({ streamFactory });

      manager.start(createProvider());

      await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_GAVE_UP", owner: "akash1owner" })), {
        timeout: 5000
      });
      expect(incidents.openIncident).toHaveBeenCalledWith("akash1owner");
      expect(incidents.openIncident).toHaveBeenCalledTimes(1);
    });

    it("does not open an incident when the stream is aborted intentionally", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, incidents } = setup({ streamFactory });

      manager.start(createProvider());
      manager.shutdown();

      await delay(100);
      expect(incidents.openIncident).not.toHaveBeenCalled();
    });

    it("closes the incident on offline → online transition", async () => {
      let attempt = 0;
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => {
        attempt++;
        if (attempt === 1) return throwingStream(new Error("initial failure"));
        return msgsThenHang([createCluster()]);
      });
      const { manager, incidents } = setup({ streamFactory });

      manager.start(createProvider());

      await vi.waitFor(() => expect(incidents.closeIncident).toHaveBeenCalledWith("akash1owner"), { timeout: 5000 });
    });

    it("closes incidents in a single batched call on stopAndDelete", async () => {
      const a = createProvider({ owner: "a", hostUri: "https://a:8443" });
      const b = createProvider({ owner: "b", hostUri: "https://b:8443" });
      const { manager, incidents } = setup({ streams: { "https://a:8443": "hang", "https://b:8443": "hang" } });
      // start() registers each stream synchronously, so stopAndDelete sees both owners without waiting
      manager.start(a);
      manager.start(b);

      await manager.stopAndDelete(["a", "b"]);

      expect(incidents.closeIncident).toHaveBeenCalledWith(["a", "b"]);
      expect(incidents.closeIncident).toHaveBeenCalledTimes(1);
    });
  });

  describe("dead provider retry policy", () => {
    it("attempts a long-dead provider at most twice before giving up", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, incidents, logger } = setup({ streamFactory });
      const longDead = createProvider({ offlineSince: new Date(Date.now() - 10_000) });

      manager.start(longDead);

      await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_GAVE_UP", owner: "akash1owner" })), {
        timeout: 5000
      });
      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2);
      expect(incidents.openIncident).toHaveBeenCalledWith("akash1owner");
    });

    it("logs STREAM_RECONNECTING only once for a long-dead provider", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, logger } = setup({ streamFactory });
      const countReconnects = () => logger.warn.mock.calls.filter(([arg]) => (arg as { event?: string })?.event === "STREAM_RECONNECTING").length;

      manager.start(createProvider({ offlineSince: new Date(Date.now() - 10_000) }));

      await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_GAVE_UP" })), { timeout: 5000 });
      expect(countReconnects()).toBe(1);
    });

    it("uses the full retry budget for a recently-updated offline provider", async () => {
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, logger } = setup({ streamFactory });

      manager.start(createProvider({ offlineSince: new Date(Date.now() - 100) }));

      await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "STREAM_GAVE_UP" })), { timeout: 5000 });
      expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(6);
    });

    it("recovers a long-dead provider when its single retry succeeds", async () => {
      let attempt = 0;
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => {
        attempt++;
        if (attempt === 1) return throwingStream(new Error("initial failure"));
        return msgsThenHang([createCluster()]);
      });
      const { manager, writer } = setup({ streamFactory });

      manager.start(createProvider({ offlineSince: new Date(Date.now() - 10_000) }));

      await vi.waitFor(() => expect(writer.updateInventory).toHaveBeenCalledTimes(1), { timeout: 5000 });
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
      let oldStreamDelivered = false;
      streamFactory.openStatusStream.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // The old stream emits an initial snapshot (so it stays open past the first-message timeout)
          // and then idles until the test resolves it to `done` to simulate a late completion.
          return {
            [Symbol.asyncIterator]() {
              return {
                next: () => {
                  if (oldStreamDelivered) return oldStreamPromise;
                  oldStreamDelivered = true;
                  return Promise.resolve<IteratorResult<ClusterState>>({ done: false, value: createCluster() });
                }
              };
            }
          };
        }
        return msgsThenHang([createCluster()]);
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
      const { manager, streamFactory } = setup({
        streams: { "https://a:8443": msgsThenHang([createCluster()]), "https://b:8443": msgsThenHang([createCluster()]) }
      });
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

  // Deterministic, GC-free leak guards. The service registers an abort listener on the caller-provided
  // (long-lived) signal and tracks each stream in #activeStreams; both must return to baseline once a
  // stream ends, is replaced, or is shut down — otherwise listeners/entries accumulate per provider over
  // the process lifetime. We assert observable invariants (parent-signal listener count and registry
  // size), never reaching into GC.
  describe("memory safety", () => {
    it("releases the parent-signal listener, empties the registry, and disposes the SDK once streams give up", async () => {
      const parent = new AbortController();
      const streamFactory = mock<ProviderStreamFactory>();
      streamFactory.disposeProvider.mockResolvedValue();
      streamFactory.openStatusStream.mockImplementation(() => throwingStream(new Error("connection lost")));
      const { manager, logger } = setup({ streamFactory });
      const giveUps = () => logger.error.mock.calls.filter(([arg]) => (arg as { event?: string })?.event === "STREAM_GAVE_UP").length;
      const providers = [
        createProvider({ owner: "a", hostUri: "https://a:8443" }),
        createProvider({ owner: "b", hostUri: "https://b:8443" }),
        createProvider({ owner: "c", hostUri: "https://c:8443" })
      ];

      for (const provider of providers) manager.start(provider, parent.signal);

      await vi.waitFor(() => expect(giveUps()).toBe(providers.length), { timeout: 5000 });

      expect(getEventListeners(parent.signal, "abort")).toHaveLength(0);
      expect(manager.getRegistry().size).toBe(0);
      for (const provider of providers) expect(streamFactory.disposeProvider).toHaveBeenCalledWith(provider.hostUri);
    });

    it("does not accumulate registry entries or parent-signal listeners across repeated restarts of one owner", async () => {
      const parent = new AbortController();
      const hostUris = ["https://h0:8443", "https://h1:8443", "https://h2:8443", "https://h3:8443"];
      const { manager, streamFactory } = setup({ streams: Object.fromEntries(hostUris.map(h => [h, msgsThenHang([createCluster()])])) });

      manager.start(createProvider({ owner: "a", hostUri: hostUris[0] }), parent.signal);
      for (let i = 1; i < hostUris.length; i++) {
        manager.restart(createProvider({ owner: "a", hostUri: hostUris[i] }), parent.signal);
        await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(i + 1));
      }

      // one owner, many restarts -> exactly one live registry entry and one live abort listener
      await vi.waitFor(() => expect(getEventListeners(parent.signal, "abort")).toHaveLength(1));
      expect(manager.getRegistry().size).toBe(1);
    });

    it("removes every parent-signal listener and clears the registry on shutdown", async () => {
      const parent = new AbortController();
      const { manager, streamFactory } = setup({
        streams: { "https://a:8443": msgsThenHang([createCluster()]), "https://b:8443": msgsThenHang([createCluster()]) }
      });
      manager.start(createProvider({ owner: "a", hostUri: "https://a:8443" }), parent.signal);
      manager.start(createProvider({ owner: "b", hostUri: "https://b:8443" }), parent.signal);
      await vi.waitFor(() => expect(streamFactory.openStatusStream).toHaveBeenCalledTimes(2));

      manager.shutdown();

      expect(manager.getRegistry().size).toBe(0);
      await vi.waitFor(() => expect(getEventListeners(parent.signal, "abort")).toHaveLength(0));
    });
  });

  function setup(input?: {
    streams?: Record<string, AsyncIterable<ClusterState> | "hang">;
    streamFactory?: MockProxy<ProviderStreamFactory>;
    throttleMs?: number;
    deadProviderThresholdMs?: number;
  }) {
    const streamFactory = input?.streamFactory ?? mock<ProviderStreamFactory>();
    streamFactory.disposeProvider.mockResolvedValue();
    const writer = mock<ProviderInventoryRepository>();
    writer.deleteByOwner.mockResolvedValue();
    writer.bulkMarkOffline.mockImplementation(async owners => owners.map(owner => ({ owner })));
    writer.updateInventory.mockResolvedValue();
    const incidents = mock<ProviderIncidentRepository>();
    incidents.openIncident.mockResolvedValue();
    incidents.closeIncident.mockResolvedValue();
    const dbDriver = mock<DbDriver>();
    dbDriver.transaction.mockImplementation(cb => cb());
    const logger = mock<LoggerService>();
    const loggerFactory: LoggerFactory = () => logger;
    const config = mock<EnvConfig>({
      MAX_CONCURRENT_STREAM_CONNECTIONS: 100,
      STREAM_RECONNECT_INITIAL_DELAY_MS: 10,
      STREAM_RECONNECT_MAX_DELAY_MS: 50,
      STREAM_FIRST_MESSAGE_TIMEOUT_MS: 80,
      STREAM_UPDATE_THROTTLE_MS: input?.throttleMs ?? 0,
      DEAD_PROVIDER_UPDATED_THRESHOLD_MS: input?.deadProviderThresholdMs ?? 1000
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

    const timer = mock<TimerService>({ delayCb: setTimeout });

    const manager = new StreamLifecycleManagerService(streamFactory, writer, incidents, dbDriver, timer, loggerFactory, config);

    return { manager, streamFactory, writer, incidents, dbDriver, logger };
  }
});

function createProvider(overrides?: Partial<ChainProviderWithOfflineSince>): ChainProviderWithOfflineSince {
  return {
    owner: "akash1owner",
    hostUri: "https://p1:8443",
    selfAttributes: [],
    signedAttributes: [],
    auditedBy: [],
    offlineSince: null,
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

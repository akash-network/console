import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";
import type { ProviderInventory, ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import type { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
import type { ChainProvider } from "@src/types/chain-provider";
import { DiscoverySchedulerService } from "./discovery-scheduler.service";

const DEAD_PROVIDER_UPDATED_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000;

describe(DiscoverySchedulerService.name, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the first tick immediately on start", async () => {
    const { poller } = setup();

    await vi.advanceTimersByTimeAsync(0);

    expect(poller.poll).toHaveBeenCalledTimes(1);
  });

  it("schedules subsequent ticks via recursive setTimeout after each tick completes", async () => {
    const { poller, config } = setup();

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(3);
  });

  it("never uses setInterval", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    setup();
    await vi.advanceTimersByTimeAsync(0);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("does not overlap ticks when a tick is slow", async () => {
    const pollDuration = 1_200_000;
    const { poller, config } = setup({ pollDelay: () => pollDuration });

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(pollDuration - config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);
  });

  it("upserts attributes and starts a stream for a brand-new provider", async () => {
    const fresh = createProvider({ owner: "fresh", hostUri: "https://fresh:8443" });
    const { writer, lifecycle } = setup({ providers: [fresh] });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.getRegistry).toHaveBeenCalled();
    expect(writer.bulkUpsertProviders).toHaveBeenCalledWith([fresh]);
    expect(lifecycle.start).toHaveBeenCalledWith({ ...fresh, offlineSince: null }, expect.any(AbortSignal));
  });

  it("forwards the provider's offline-since timestamp to lifecycle.start", async () => {
    const offline = createProvider({ owner: "offline", hostUri: "https://offline:8443" });
    const offlineSince = new Date(Date.now() - 60_000);
    const { lifecycle } = setup({ providers: [offline], offlineSince: new Map([[offline.owner, offlineSince]]) });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.start).toHaveBeenCalledWith({ ...offline, offlineSince }, expect.any(AbortSignal));
  });

  it("skips a provider whose open incident is older than the dead-provider threshold", async () => {
    const dead = createProvider({ owner: "dead", hostUri: "https://dead:8443" });
    const offlineSince = new Date(Date.now() - DEAD_PROVIDER_UPDATED_THRESHOLD_MS - 1_000);
    const { lifecycle, logger } = setup({ providers: [dead], offlineSince: new Map([[dead.owner, offlineSince]]) });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.start).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_SKIP_PROVIDER", owner: "dead" }));
  });

  it("retries a dead provider instead of skipping it when its on-chain record changed this tick", async () => {
    const dead = createProvider({ owner: "dead", hostUri: "https://dead:8443" });
    const offlineSince = new Date(Date.now() - DEAD_PROVIDER_UPDATED_THRESHOLD_MS - 1_000);
    const { writer, lifecycle, logger } = setup({ providers: [dead], offlineSince: new Map([[dead.owner, offlineSince]]) });
    writer.bulkUpsertProviders.mockResolvedValue([{ owner: dead.owner }]);

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.start).toHaveBeenCalledWith({ ...dead, offlineSince }, expect.any(AbortSignal));
    expect(logger.debug).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_SKIP_PROVIDER" }));
  });

  it("starts a provider that has no open incident instead of flagging it dead", async () => {
    // dead detection keys off open incidents only — a provider with no open incident is never skipped,
    // regardless of how stale its inventory row is
    const provider = createProvider({ owner: "healthy", hostUri: "https://healthy:8443" });
    const { lifecycle, logger } = setup({ providers: [provider], offlineSince: new Map() });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.start).toHaveBeenCalledWith({ ...provider, offlineSince: null }, expect.any(AbortSignal));
    expect(logger.debug).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_SKIP_PROVIDER" }));
  });

  it("does not stop-and-delete a dead provider that is still registered on-chain", async () => {
    // A dead provider is still on-chain, so its inventory row and open incident must be preserved.
    // Deleting them (via stopAndDelete) would reset dead-detection and re-monitor it as brand-new next tick.
    const dead = createProvider({ owner: "dead", hostUri: "https://dead:8443" });
    const offlineSince = new Date(Date.now() - DEAD_PROVIDER_UPDATED_THRESHOLD_MS - 1_000);
    const { lifecycle } = setup({
      providers: [dead],
      watched: new Map([["dead", { hostUri: "https://dead:8443" }]]),
      offlineSince: new Map([[dead.owner, offlineSince]])
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.start).not.toHaveBeenCalled();
    expect(lifecycle.stopAndDelete).not.toHaveBeenCalled();
  });

  it("stops and deletes a watched provider that is no longer returned by the poller", async () => {
    const stillOnChain = createProvider({ owner: "alive", hostUri: "https://alive:8443" });
    const { lifecycle } = setup({
      providers: [stillOnChain],
      watched: new Map([
        ["alive", { hostUri: "https://alive:8443" }],
        ["gone", { hostUri: "https://gone:8443" }]
      ])
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.stopAndDelete).toHaveBeenCalledWith(["gone"]);
  });

  it("forwards the offline-since timestamp to lifecycle.restart when an observed provider changes hostUri", async () => {
    const updated = createProvider({ owner: "moving", hostUri: "https://new:8443" });
    const offlineSince = new Date(Date.now() - 60_000);
    const { lifecycle } = setup({
      providers: [updated],
      watched: new Map([["moving", { hostUri: "https://old:8443" }]]),
      offlineSince: new Map([[updated.owner, offlineSince]])
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.restart).toHaveBeenCalledWith({ ...updated, offlineSince }, expect.any(AbortSignal));
  });

  it("continues after a poll error and re-arms the next tick", async () => {
    const { poller, config, logger } = setup({ pollError: new Error("chain RPC unavailable") });

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_TICK_ERROR" }));

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);
  });

  it("logs and does not start new providers when bulkUpsertProviders throws", async () => {
    const provider = createProvider();
    const { writer, lifecycle, logger } = setup({ providers: [provider] });
    writer.bulkUpsertProviders.mockRejectedValueOnce(new Error("DB down"));

    await vi.advanceTimersByTimeAsync(0);

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "UPSERT_PROVIDERS_ERROR", owners: [provider.owner] }));
    expect(lifecycle.start).not.toHaveBeenCalled();
  });

  it("prunes incidents older than the configured retention window on the first tick", async () => {
    const { incidentRepository, config } = setup();

    await vi.advanceTimersByTimeAsync(0);

    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(1);
    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledWith(config.INCIDENT_RETENTION_DAYS);
  });

  it("does not prune again on subsequent ticks within the cleanup interval", async () => {
    const { incidentRepository, config } = setup();

    await vi.advanceTimersByTimeAsync(0);
    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS * 5);
    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(1);
  });

  it("prunes again once the cleanup interval has elapsed", async () => {
    const { incidentRepository, config } = setup();

    await vi.advanceTimersByTimeAsync(0);
    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.INCIDENT_CLEANUP_INTERVAL_MS);
    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(2);
  });

  it("still prunes incidents when the poll fails so cleanup is not blocked by a tick error", async () => {
    const { incidentRepository } = setup({ pollError: new Error("chain RPC unavailable") });

    await vi.advanceTimersByTimeAsync(0);

    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(1);
  });

  it("retries the prune on the next tick when cleanup fails rather than waiting a full interval", async () => {
    const { incidentRepository, poller, config, logger } = setup();
    incidentRepository.deleteEndedBefore.mockRejectedValueOnce(new Error("DB down"));

    await vi.advanceTimersByTimeAsync(0);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_INCIDENTS_CLEANUP_ERROR" }));

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);
    expect(incidentRepository.deleteEndedBefore).toHaveBeenCalledTimes(2);
  });

  it("stops scheduling after stop is called", async () => {
    const { scheduler, poller, config } = setup();

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    scheduler.stop();

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS * 10);
    expect(poller.poll).toHaveBeenCalledTimes(1);
  });

  it("is idempotent on multiple start calls", async () => {
    const { scheduler, poller } = setup();

    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.poll).toHaveBeenCalledTimes(1);
  });

  describe("warmUp", () => {
    it("starts a stream for each owner currently marked online in the database", async () => {
      const onlineOwners: Pick<ProviderInventory, "owner" | "hostUri">[] = [
        { owner: "akash1a", hostUri: "https://a:8443" },
        { owner: "akash1b", hostUri: "https://b:8443" }
      ];
      const { scheduler, lifecycle } = setup({ onlineOwners, autoStart: false });

      await scheduler.warmUp();

      expect(lifecycle.start).toHaveBeenCalledTimes(2);
      expect(lifecycle.start).toHaveBeenCalledWith(expect.objectContaining({ owner: "akash1a", hostUri: "https://a:8443" }), undefined);
      expect(lifecycle.start).toHaveBeenCalledWith(expect.objectContaining({ owner: "akash1b", hostUri: "https://b:8443" }), undefined);
    });

    it("is a no-op when no providers are marked online (first-ever boot)", async () => {
      const { scheduler, lifecycle, logger } = setup({ onlineOwners: [], autoStart: false });

      await scheduler.warmUp();

      expect(lifecycle.start).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_ONLINE_WARM_UP_SKIPPED" }));
    });

    it("forwards the abort signal to lifecycle.start", async () => {
      const onlineOwners: Pick<ProviderInventory, "owner" | "hostUri">[] = [{ owner: "akash1a", hostUri: "https://a:8443" }];
      const { scheduler, lifecycle } = setup({ onlineOwners, autoStart: false });
      const signal = new AbortController().signal;

      await scheduler.warmUp(signal);

      expect(lifecycle.start).toHaveBeenCalledWith(expect.objectContaining({ owner: "akash1a" }), signal);
    });

    it("logs the dispatched count so operators can observe warm-up from boot logs", async () => {
      const onlineOwners: Pick<ProviderInventory, "owner" | "hostUri">[] = [
        { owner: "akash1a", hostUri: "https://a:8443" },
        { owner: "akash1b", hostUri: "https://b:8443" }
      ];
      const { scheduler, logger } = setup({ onlineOwners, autoStart: false });

      await scheduler.warmUp();

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_ONLINE_WARM_UP_STARTED", providerCount: 2 }));
    });

    it("surfaces the failure to the bootstrap caller when the database read fails — boot is aborted, not silently degraded", async () => {
      const { scheduler, lifecycle, writer } = setup({ onlineOwners: [], autoStart: false });
      writer.streamOnlineProviders.mockReturnValueOnce(asyncIterableThatThrows(new Error("DB down")));

      await expect(scheduler.warmUp()).rejects.toThrow("DB down");

      expect(lifecycle.start).not.toHaveBeenCalled();
    });

    it("does not await connection settling — returns as soon as starts are dispatched", async () => {
      const onlineOwners: Pick<ProviderInventory, "owner" | "hostUri">[] = [{ owner: "akash1a", hostUri: "https://a:8443" }];
      const { scheduler, lifecycle } = setup({ onlineOwners, autoStart: false });

      await scheduler.warmUp();

      expect(lifecycle.start).toHaveBeenCalledTimes(1);
      expect(lifecycle.waitForPendingConnections).not.toHaveBeenCalled();
    });
  });

  function setup(input?: {
    providers?: ChainProvider[];
    pollError?: Error;
    pollDelay?: (config: EnvConfig) => number;
    onlineOwners?: Pick<ProviderInventory, "owner" | "hostUri">[];
    autoStart?: boolean;
    watched?: Map<string, { hostUri: string }>;
    offlineSince?: Map<string, Date>;
  }) {
    const poller = mock<ChainProviderPollerService>();
    const writer = mock<ProviderInventoryRepository>();
    const incidentRepository = mock<ProviderIncidentRepository>();
    const lifecycle = mock<StreamLifecycleManagerService>();
    lifecycle.getRegistry.mockReturnValue(input?.watched ?? new Map());
    lifecycle.stopAndDelete.mockResolvedValue();
    lifecycle.waitForPendingConnections.mockResolvedValue();
    writer.bulkUpsertProviders.mockResolvedValue([]);
    incidentRepository.getOfflineSince.mockResolvedValue(input?.offlineSince ?? new Map());
    incidentRepository.deleteEndedBefore.mockResolvedValue(0);

    const onlineOwners = input?.onlineOwners ?? [];
    writer.streamOnlineProviders.mockReturnValue(
      (async function* () {
        for (const owner of onlineOwners) yield owner;
      })()
    );

    const logger = mock<ReturnType<LoggerFactory>>();
    const loggerFactory: LoggerFactory = () => logger;
    const config = {
      PROVIDER_INVENTORY_POSTGRES_URL: "postgres://localhost/test",
      DRIZZLE_MIGRATIONS_FOLDER: "./drizzle",
      LOG_LEVEL: "info",
      STD_OUT_LOG_FORMAT: "json",
      PORT: 3092,
      DISCOVERY_INTERVAL_MS: 600_000,
      STREAM_RECONNECT_INITIAL_DELAY_MS: 1_000,
      STREAM_RECONNECT_MAX_DELAY_MS: 300_000,
      STREAM_FIRST_MESSAGE_TIMEOUT_MS: 10_000,
      DEAD_PROVIDER_UPDATED_THRESHOLD_MS,
      REST_API_NODE_URL: "http://localhost:1317",
      INCIDENT_RETENTION_DAYS: 31,
      INCIDENT_CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000
    } as EnvConfig;

    if (input?.pollError) {
      const error = input.pollError;
      // eslint-disable-next-line require-yield
      poller.poll.mockImplementation(async function* () {
        throw error;
      });
    } else if (input?.pollDelay) {
      const delay = input.pollDelay(config);
      const providers = input?.providers ?? [];
      poller.poll.mockImplementation(async function* () {
        await new Promise<void>(resolve => {
          setTimeout(resolve, delay);
        });
        yield providers;
      });
    } else {
      const providers = input?.providers ?? [];
      poller.poll.mockImplementation(async function* () {
        yield providers;
      });
    }

    const scheduler = new DiscoverySchedulerService(poller, writer, incidentRepository, lifecycle, config, loggerFactory);
    if (input?.autoStart !== false) scheduler.start();

    return { scheduler, poller, writer, incidentRepository, lifecycle, config, logger };
  }
});

function asyncIterableThatThrows<T>(error: Error): AsyncGenerator<T> {
  return {
    next: () => Promise.reject(error),
    return: value => Promise.resolve({ value, done: true }),
    throw: e => Promise.reject(e),
    [Symbol.asyncIterator]() {
      return this;
    }
  } as AsyncGenerator<T>;
}

function createProvider(overrides?: Partial<ChainProvider>): ChainProvider {
  return {
    owner: "akash1abc",
    hostUri: "https://provider.example.com:8443",
    selfAttributes: [],
    signedAttributes: [],
    auditedBy: [],
    ...overrides
  };
}

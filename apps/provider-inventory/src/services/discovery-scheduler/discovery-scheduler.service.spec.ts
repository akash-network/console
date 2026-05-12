import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import type { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
import type { ChainProvider } from "@src/types/chain-provider";
import { DiscoverySchedulerService } from "./discovery-scheduler.service";

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

  it("dispatches each reconciler command to the right handler", async () => {
    const fresh = createProvider({ owner: "fresh", hostUri: "https://fresh:8443" });
    const { writer, lifecycle } = setup({ providers: [fresh] });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.getRegistry).toHaveBeenCalled();
    expect(writer.upsertAttributes).toHaveBeenCalledWith(fresh);
    expect(lifecycle.start).toHaveBeenCalledWith(fresh);
  });

  it("dispatches refreshAttributes in createdHeight DESC order so winners commit before losers", async () => {
    const a = createProvider({ owner: "a", createdHeight: 100n });
    const b = createProvider({ owner: "b", createdHeight: 200n });
    const c = createProvider({ owner: "c", createdHeight: 50n });
    const { writer } = setup({ providers: [a, b, c] });

    await vi.advanceTimersByTimeAsync(0);

    const orderedOwners = writer.upsertAttributes.mock.calls.map(([p]) => p.owner);
    expect(orderedOwners).toEqual(["b", "a", "c"]);
  });

  it("continues after a poll error and re-arms the next tick", async () => {
    const { poller, config, logger } = setup({ pollError: new Error("chain RPC unavailable") });

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DISCOVERY_TICK_ERROR" }));

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);
  });

  it("logs and continues when upsertAttributes throws", async () => {
    const provider = createProvider();
    const { writer, lifecycle, logger } = setup({ providers: [provider] });
    writer.upsertAttributes.mockRejectedValueOnce(new Error("DB down"));

    await vi.advanceTimersByTimeAsync(0);

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "REFRESH_ATTRIBUTES_ERROR", owner: provider.owner }));
    expect(lifecycle.start).toHaveBeenCalled();
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

  function setup(input?: { providers?: ChainProvider[]; pollError?: Error; pollDelay?: (config: EnvConfig) => number }) {
    const poller = mock<ChainProviderPollerService>();
    const writer = mock<ProviderInventoryRepository>();
    const lifecycle = mock<StreamLifecycleManagerService>();
    lifecycle.getRegistry.mockReturnValue(new Map());
    lifecycle.stopAndDelete.mockResolvedValue();
    writer.upsertAttributes.mockResolvedValue();

    const logger = mock<ReturnType<LoggerFactory>>();
    const loggerFactory: LoggerFactory = () => logger;
    const config: EnvConfig = {
      PROVIDER_INVENTORY_POSTGRES_URL: "postgres://localhost/test",
      DRIZZLE_MIGRATIONS_FOLDER: "./drizzle",
      LOG_LEVEL: "info",
      STD_OUT_LOG_FORMAT: "json",
      PORT: 3092,
      DISCOVERY_INTERVAL_MS: 600_000
    };

    if (input?.pollError) {
      poller.poll.mockRejectedValue(input.pollError);
    } else if (input?.pollDelay) {
      const delay = input.pollDelay(config);
      poller.poll.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(input?.providers ?? []), delay);
          })
      );
    } else {
      poller.poll.mockResolvedValue(input?.providers ?? []);
    }

    const scheduler = new DiscoverySchedulerService(poller, writer, lifecycle, config, loggerFactory);
    scheduler.start();

    return { scheduler, poller, writer, lifecycle, config, logger };
  }
});

function createProvider(overrides?: Partial<ChainProvider>): ChainProvider {
  return {
    owner: "akash1abc",
    hostUri: "https://provider.example.com:8443",
    createdHeight: 100n,
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}

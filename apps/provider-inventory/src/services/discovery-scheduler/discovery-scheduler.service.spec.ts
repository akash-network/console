import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ChainProviderPollerService } from "@src/services/chain-provider-poller/chain-provider-poller.service";
import type { StreamLifecycleManagerService } from "@src/services/stream-lifecycle-manager/stream-lifecycle-manager.service";
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
    const { poller, config } = setup({
      pollDelay: () => pollDuration
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    // Mid-poll: no second tick despite interval elapsed
    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    // Poll completes at pollDuration; next tick is scheduled DISCOVERY_INTERVAL_MS later
    await vi.advanceTimersByTimeAsync(pollDuration - config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    // Advance past the scheduled interval after tick completion
    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);
  });

  it("passes polled providers to the lifecycle manager", async () => {
    const fakeProviders = [{ owner: "akash1abc", hostUri: "https://provider.example.com:8443", createdHeight: 100n, selfAttributes: [], signedAttributes: [] }];
    const { lifecycle } = setup({ providers: fakeProviders });

    await vi.advanceTimersByTimeAsync(0);

    expect(lifecycle.reconcile).toHaveBeenCalledWith(fakeProviders);
  });

  it("continues scheduling after a poll error", async () => {
    const { poller, config } = setup({ pollError: new Error("chain RPC unavailable") });

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.DISCOVERY_INTERVAL_MS);
    expect(poller.poll).toHaveBeenCalledTimes(2);
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

  function setup(input?: {
    providers?: Array<{ owner: string; hostUri: string; createdHeight: bigint; selfAttributes: never[]; signedAttributes: never[] }>;
    pollError?: Error;
    pollDelay?: (config: EnvConfig) => number;
  }) {
    const poller = mock<ChainProviderPollerService>();
    const lifecycle = mock<StreamLifecycleManagerService>();
    const loggerFactory: LoggerFactory = () => mock<ReturnType<LoggerFactory>>();
    const config: EnvConfig = {
      PROVIDER_INVENTORY_POSTGRES_URL: "postgres://localhost/test",
      DRIZZLE_MIGRATIONS_FOLDER: "./drizzle",
      LOG_LEVEL: "info",
      STD_OUT_LOG_FORMAT: "json",
      NODE_ENV: "test",
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

    const scheduler = new DiscoverySchedulerService(poller, lifecycle, config, loggerFactory);
    scheduler.start();

    return { scheduler, poller, lifecycle, config };
  }
});

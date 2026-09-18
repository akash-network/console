import { describe, expect, it, vi } from "vitest";

import type { ProviderConnectionTrackerInstrumentation } from "./ProviderConnectionTracker";
import { ProviderConnectionTracker, toStateRetentionMs } from "./ProviderConnectionTracker";

describe(ProviderConnectionTracker.name, () => {
  it("keeps dialing until the failure threshold is reached", () => {
    const { tracker, fail } = setup({ failureThreshold: 3 });

    fail("provider-a");
    fail("provider-a");

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);

    fail("provider-a");

    expect(tracker.shouldSkipDial("provider-a")).toBe(true);
  });

  it.each(["ETIMEDOUT", "EPIPE"])("never starts a cooldown for %s", errno => {
    const { tracker, fail } = setup({ failureThreshold: 1 });

    fail("provider-a", errno);
    fail("provider-a", errno);

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
  });

  it("starts a cooldown when the dial is reset", () => {
    const { tracker, fail } = setup({ failureThreshold: 1 });

    fail("provider-a", "ECONNRESET");

    expect(tracker.shouldSkipDial("provider-a")).toBe(true);
  });

  it("allows exactly one probe per cooldown window, even when asked concurrently", () => {
    const { tracker, fail, advance } = setup({ failureThreshold: 1, cooldownMs: 60_000 });

    fail("provider-a");
    advance(60_000);

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
    expect(tracker.shouldSkipDial("provider-a")).toBe(true);
    expect(tracker.shouldSkipDial("provider-a")).toBe(true);
  });

  it("re-arms the cooldown when the probe fails again", () => {
    const { tracker, fail, advance } = setup({ failureThreshold: 1, cooldownMs: 60_000 });

    fail("provider-a");
    advance(60_000);
    tracker.shouldSkipDial("provider-a");
    advance(30_000);

    expect(tracker.shouldSkipDial("provider-a")).toBe(true);
  });

  it("lengthens each cooldown while the provider stays unreachable", () => {
    const { tracker, fail, advance } = setup({ failureThreshold: 1, cooldownMs: 60_000 });

    fail("provider-a");
    advance(60_000);
    tracker.shouldSkipDial("provider-a");
    fail("provider-a");
    advance(60_000);

    expect(tracker.shouldSkipDial("provider-a")).toBe(true);

    advance(60_000);

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
  });

  it("caps how long a cooldown can grow", () => {
    const { tracker, fail, advance } = setup({ failureThreshold: 1, cooldownMs: 60_000, maxCooldownMs: 120_000 });

    for (let attempt = 0; attempt < 10; attempt++) fail("provider-a");
    advance(119_999);

    expect(tracker.shouldSkipDial("provider-a")).toBe(true);

    advance(1);

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
  });

  it("returns to the base cooldown once the provider answers", () => {
    const { tracker, fail, advance } = setup({ failureThreshold: 1, cooldownMs: 60_000 });

    fail("provider-a");
    fail("provider-a");
    fail("provider-a");
    tracker.recordReachable("provider-a");
    fail("provider-a");
    advance(60_000);

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
  });

  it("reports a failure that follows an earlier one as repeated", () => {
    const { tracker, fail } = setup({ failureThreshold: 3 });

    fail("provider-a");

    expect(tracker.isRepeatedFailure("provider-a", "EHOSTUNREACH")).toBe(false);

    fail("provider-a");

    expect(tracker.isRepeatedFailure("provider-a", "EHOSTUNREACH")).toBe(true);
  });

  it("reports nothing as repeated for a provider it never saw fail", () => {
    const { tracker } = setup();

    expect(tracker.isRepeatedFailure("provider-a", "EHOSTUNREACH")).toBe(false);
  });

  it.each(["ETIMEDOUT", "EPIPE"])("reports nothing as repeated for %s, which it never counted", errno => {
    const { tracker, fail } = setup({ failureThreshold: 3 });

    fail("provider-a");
    fail("provider-a");

    expect(tracker.isRepeatedFailure("provider-a", errno)).toBe(false);
  });

  it("reports a dial that timed out after an earlier one as repeated", () => {
    const { tracker, hang } = setup({ failureThreshold: 3 });

    hang("provider-a");

    expect(tracker.hasRepeatedFailures("provider-a")).toBe(false);

    hang("provider-a");

    expect(tracker.hasRepeatedFailures("provider-a")).toBe(true);
  });

  it("counts a dial that timed out toward a provider that was already failing", () => {
    const { tracker, fail, hang } = setup({ failureThreshold: 3 });

    fail("provider-a");
    hang("provider-a");

    expect(tracker.hasRepeatedFailures("provider-a")).toBe(true);
  });

  it("never starts a cooldown for a provider that only times out", () => {
    const { tracker, hang } = setup({ failureThreshold: 1 });

    hang("provider-a");
    hang("provider-a");
    hang("provider-a");

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
  });

  it("forgets timed-out dials once the provider answers", () => {
    const { tracker, hang } = setup({ failureThreshold: 3 });

    hang("provider-a");
    hang("provider-a");
    tracker.recordReachable("provider-a");

    expect(tracker.hasRepeatedFailures("provider-a")).toBe(false);
  });

  it("hands back the error from a dial that timed out", () => {
    const { tracker } = setup();
    const error = new Error("socket hang up");

    tracker.recordUnresponsive("provider-a", error);

    expect(tracker.getLastError("provider-a")).toBe(error);
  });

  it("resumes dialing once the provider answers", () => {
    const { tracker, fail } = setup({ failureThreshold: 1 });

    fail("provider-a");
    tracker.recordReachable("provider-a");

    expect(tracker.shouldSkipDial("provider-a")).toBe(false);
  });

  it("counts failures per key", () => {
    const { tracker, fail } = setup({ failureThreshold: 2 });

    fail("provider-a");
    fail("provider-b");
    fail("provider-a");

    expect(tracker.shouldSkipDial("provider-a")).toBe(true);
    expect(tracker.shouldSkipDial("provider-b")).toBe(false);
  });

  it("hands back the error that caused the cooldown", () => {
    const { tracker } = setup({ failureThreshold: 1 });
    const error = Object.assign(new Error("connect EHOSTUNREACH"), { code: "EHOSTUNREACH" });

    tracker.recordUnreachable("provider-a", error, "EHOSTUNREACH");

    expect(tracker.getLastError("provider-a")).toBe(error);
  });

  it("reports a cooldown starting and clearing", () => {
    const instrumentation = { onCooldownStarted: vi.fn(), onProbeAllowed: vi.fn(), onCleared: vi.fn() };
    const { tracker, fail } = setup({ failureThreshold: 1, instrumentation });

    fail("provider-a");
    tracker.recordReachable("provider-a");

    expect(instrumentation.onCooldownStarted).toHaveBeenCalledWith("provider-a", "EHOSTUNREACH", expect.any(Number));
    expect(instrumentation.onCleared).toHaveBeenCalledWith("provider-a");
  });

  it("stays quiet about a provider it never saw fail", () => {
    const instrumentation = { onCleared: vi.fn() };
    const { tracker } = setup({ instrumentation });

    tracker.recordReachable("provider-a");

    expect(instrumentation.onCleared).not.toHaveBeenCalled();
  });

  it("keeps a short-cooldown provider in memory for the default retention", () => {
    expect(toStateRetentionMs(60_000)).toBe(10 * 60 * 1000);
  });

  it("retains a provider past a cooldown longer than the default retention", () => {
    expect(toStateRetentionMs(15 * 60 * 1000)).toBeGreaterThan(15 * 60 * 1000);
  });

  function setup(
    input: {
      failureThreshold?: number;
      cooldownMs?: number;
      maxCooldownMs?: number;
      instrumentation?: ProviderConnectionTrackerInstrumentation;
    } = {}
  ) {
    let clock = 1_000;
    const tracker = new ProviderConnectionTracker(
      () => clock,
      {
        failureThreshold: input.failureThreshold ?? 3,
        cooldownMs: input.cooldownMs ?? 60_000,
        maxCooldownMs: input.maxCooldownMs ?? 15 * 60 * 1000
      },
      input.instrumentation
    );

    return {
      tracker,
      advance: (ms: number) => {
        clock += ms;
      },
      fail: (key: string, errno = "EHOSTUNREACH") => tracker.recordUnreachable(key, Object.assign(new Error(errno), { code: errno }), errno),
      hang: (key: string) => tracker.recordUnresponsive(key, Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }))
    };
  }
});

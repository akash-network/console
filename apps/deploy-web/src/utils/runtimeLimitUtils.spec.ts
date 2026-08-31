import { describe, expect, it } from "vitest";

import { getRuntimeLimitCountdown } from "./runtimeLimitUtils";

const NOW = Date.parse("2026-08-21T12:00:00.000Z");

describe(getRuntimeLimitCountdown.name, () => {
  it("shows only the limit before the countdown is anchored", () => {
    const countdown = getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: null, now: NOW });

    expect(countdown.status).toBe("unanchored");
    expect(countdown.remainingLabel).toBe("12h");
    expect(countdown.captionLabel).toBe("runtime limit");
  });

  it("measures the remaining share against the granted limit", () => {
    const countdown = getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T18:00:00.000Z", now: NOW });

    expect(countdown.status).toBe("running");
    expect(countdown.remainingLabel).toBe("6h left");
    expect(countdown.captionLabel).toBe("of 12h limit");
    expect(countdown.accessibleLabel).toBe("6h of 12h left");
    expect(countdown.percentRemaining).toBe(50);
  });

  it("adds the minutes when the remaining time is not a whole number of hours", () => {
    expect(getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T14:10:00.000Z", now: NOW }).remainingLabel).toBe("2h 10m left");
  });

  it("counts in minutes alone once under an hour remains", () => {
    expect(getRuntimeLimitCountdown({ runtimeLimitHours: 1, runtimeEndsAt: "2026-08-21T12:36:00.000Z", now: NOW }).remainingLabel).toBe("36m left");
  });

  it("keeps the meter visible through the final seconds, alongside a full-minute reading", () => {
    const countdown = getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T12:00:01.000Z", now: NOW });

    expect(countdown.remainingLabel).toBe("1m left");
    expect(countdown.percentRemaining).toBe(1);
  });

  it("marks the limit as reached once the deadline passes", () => {
    const countdown = getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T11:00:00.000Z", now: NOW });

    expect(countdown.status).toBe("reached");
    expect(countdown.remainingLabel).toBe("Limit reached");
    expect(countdown.captionLabel).toBe("12h limit");
    expect(countdown.accessibleLabel).toBe("12h limit reached");
    expect(countdown.percentRemaining).toBe(0);
  });

  it("caps the meter when the deadline sits further out than the limit allows", () => {
    expect(getRuntimeLimitCountdown({ runtimeLimitHours: 1, runtimeEndsAt: "2026-08-21T20:00:00.000Z", now: NOW }).percentRemaining).toBe(100);
  });

  it("keeps the meter finite when the limit itself is zero", () => {
    expect(getRuntimeLimitCountdown({ runtimeLimitHours: 0, runtimeEndsAt: "2026-08-21T13:00:00.000Z", now: NOW }).percentRemaining).toBe(100);
  });

  it("freezes on a stopped deployment rather than claiming the time left over", () => {
    const countdown = getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T18:00:00.000Z", hasStopped: true, now: NOW });

    expect(countdown.status).toBe("ended");
    expect(countdown.remainingLabel).toBe("Runtime ended");
    expect(countdown.captionLabel).toBe("of 12h limit");
    expect(countdown.accessibleLabel).toBe("Runtime ended, 12h limit");
    expect(countdown.percentRemaining).toBe(0);
  });

  it("keeps reading as ended once a stopped deployment's deadline passes, so the label never changes after the close", () => {
    const countdown = getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T11:00:00.000Z", hasStopped: true, now: NOW });

    expect(countdown.status).toBe("ended");
    expect(countdown.remainingLabel).toBe("Runtime ended");
  });

  it("stays unanchored on a stopped deployment whose countdown never started", () => {
    expect(getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: null, hasStopped: true, now: NOW }).status).toBe("unanchored");
  });

  it("treats an unparseable deadline as unanchored rather than reached", () => {
    expect(getRuntimeLimitCountdown({ runtimeLimitHours: 12, runtimeEndsAt: "not-a-date", now: NOW }).status).toBe("unanchored");
  });
});

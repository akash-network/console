import { afterEach, describe, expect, it, vi } from "vitest";

import { RecentRead } from "./recent-read";

describe(RecentRead.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("recalls nothing before anything was read", () => {
    const { recentRead } = setup();

    expect(recentRead.recall()).toBeUndefined();
  });

  it("hands back the value it is asked to remember", () => {
    const { recentRead } = setup();

    expect(recentRead.remember("open")).toBe("open");
  });

  it("recalls a value up to the age it was given", () => {
    const { recentRead } = setup();
    recentRead.remember("open");

    vi.setSystemTime("2026-11-28T10:01:00.000Z");

    expect(recentRead.recall()).toEqual({ value: "open" });
  });

  it("recalls nothing once the value is older than the age it was given", () => {
    const { recentRead } = setup();
    recentRead.remember("open");

    vi.setSystemTime("2026-11-28T10:01:00.001Z");

    expect(recentRead.recall()).toBeUndefined();
  });

  it("recalls a remembered undefined as an answer", () => {
    const { recentRead } = setup();
    recentRead.remember(undefined);

    expect(recentRead.recall()).toEqual({ value: undefined });
  });

  it("recalls the latest of two values, counting its age from when it was remembered", () => {
    const { recentRead } = setup();
    recentRead.remember("open");
    vi.setSystemTime("2026-11-28T10:00:50.000Z");
    recentRead.remember("frozen");

    vi.setSystemTime("2026-11-28T10:01:30.000Z");

    expect(recentRead.recall()).toEqual({ value: "frozen" });
  });

  function setup() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-11-28T10:00:00.000Z");

    return { recentRead: new RecentRead<string | undefined>(60_000) };
  }
});

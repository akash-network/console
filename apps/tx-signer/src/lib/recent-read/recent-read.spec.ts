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

  it("hands back what the read answers", async () => {
    const { recentRead } = setup();

    await expect(recentRead.refresh(async () => "open")).resolves.toBe("open");
  });

  it("recalls an answer up to the age it was given", async () => {
    const { recentRead } = setup();
    await recentRead.refresh(async () => "open");

    vi.setSystemTime("2026-11-28T10:01:00.000Z");

    expect(recentRead.recall()).toEqual({ value: "open" });
  });

  it("recalls nothing once the answer is older than the age it was given", async () => {
    const { recentRead } = setup();
    await recentRead.refresh(async () => "open");

    vi.setSystemTime("2026-11-28T10:01:00.001Z");

    expect(recentRead.recall()).toBeUndefined();
  });

  it("ages an answer from when it was asked for, not from when it arrived", async () => {
    const { recentRead } = setup();
    const slowRead = deferred<string>();
    const reading = recentRead.refresh(() => slowRead.promise);
    vi.setSystemTime("2026-11-28T10:00:30.000Z");
    slowRead.resolve("open");
    await reading;

    vi.setSystemTime("2026-11-28T10:01:00.001Z");

    expect(recentRead.recall()).toBeUndefined();
  });

  it("recalls an undefined answer as an answer", async () => {
    const { recentRead } = setup();
    await recentRead.refresh(async () => undefined);

    expect(recentRead.recall()).toEqual({ value: undefined });
  });

  it("recalls the later of two answers, aged from when that one was asked for", async () => {
    const { recentRead } = setup();
    await recentRead.refresh(async () => "open");
    vi.setSystemTime("2026-11-28T10:00:50.000Z");
    await recentRead.refresh(async () => "frozen");

    vi.setSystemTime("2026-11-28T10:01:30.000Z");

    expect(recentRead.recall()).toEqual({ value: "frozen" });
  });

  it("keeps the answer of the read asked for last when an earlier one arrives after it", async () => {
    const { recentRead } = setup();
    const earlierRead = deferred<string>();
    const earlier = recentRead.refresh(() => earlierRead.promise);
    await recentRead.refresh(async () => "frozen");

    earlierRead.resolve("open");

    await expect(earlier).resolves.toBe("open");
    expect(recentRead.recall()).toEqual({ value: "frozen" });
  });

  it("keeps the answer of an earlier read when the one asked for after it fails", async () => {
    const { recentRead } = setup();
    const earlierRead = deferred<string>();
    const earlier = recentRead.refresh(() => earlierRead.promise);
    await expect(
      recentRead.refresh(async () => {
        throw new Error("connection reset");
      })
    ).rejects.toThrow("connection reset");

    earlierRead.resolve("open");
    await earlier;

    expect(recentRead.recall()).toEqual({ value: "open" });
  });

  it("keeps what it had when a read fails", async () => {
    const { recentRead } = setup();
    await recentRead.refresh(async () => "open");

    await expect(
      recentRead.refresh(async () => {
        throw new Error("connection reset");
      })
    ).rejects.toThrow("connection reset");

    expect(recentRead.recall()).toEqual({ value: "open" });
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(resolvePromise => {
      resolve = resolvePromise;
    });

    return { promise, resolve };
  }

  function setup() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-11-28T10:00:00.000Z");

    return { recentRead: new RecentRead<string | undefined>(60_000) };
  }
});

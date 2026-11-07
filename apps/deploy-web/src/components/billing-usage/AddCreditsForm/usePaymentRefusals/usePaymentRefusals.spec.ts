import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecentPaymentRefusals } from "./usePaymentRefusals";
import { MAX_REFUSALS_PER_WINDOW, REFUSAL_WINDOW_MS, REFUSALS_PER_PAYMENT_METHOD, usePaymentRefusals } from "./usePaymentRefusals";

import { act, renderHook } from "@testing-library/react";

const STORAGE_KEY = "add-credits-refusals";
const MINUTE_MS = 60_000;

describe(usePaymentRefusals.name, () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("counts refusals for each payment method", () => {
    const { result } = setup();

    act(() => {
      expect(result.current.record("pm_first")).toBe(1);
      expect(result.current.record("pm_first")).toBe(2);
      expect(result.current.record("pm_second")).toBe(1);
    });

    expect(result.current.countFor("pm_first")).toBe(2);
    expect(result.current.countFor("pm_second")).toBe(1);
    expect(result.current.countFor("pm_other")).toBe(0);
  });

  it("counts a refusal without a payment method toward none of them", () => {
    const { result } = setup();

    act(() => {
      expect(result.current.record()).toBe(1);
    });

    expect(result.current.countFor("pm_first")).toBe(0);
  });

  it("remembers refusals after Add credits is closed and opened again", () => {
    const first = setup();
    act(() => {
      first.result.current.record("pm_link");
    });
    first.unmount();

    const { result } = setup();

    expect(result.current.countFor("pm_link")).toBe(1);
  });

  it("keeps each user's refusals apart", () => {
    const other = setup({ userId: "user_other" });
    act(() => {
      other.result.current.record("pm_link");
    });

    const { result } = setup();

    expect(result.current.countFor("pm_link")).toBe(0);
    act(() => {
      expect(result.current.record("pm_link")).toBe(1);
    });
  });

  it("records nothing until the user is known", () => {
    const { result } = setup({ userId: undefined });

    act(() => {
      expect(result.current.record("pm_link")).toBe(0);
    });

    expect(result.current.countFor("pm_link")).toBe(0);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("pauses payments once five refusals land within half an hour, until the oldest of them is half an hour old", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup();
    const firstRefusedAt = Date.now();

    for (let refusal = 1; refusal < MAX_REFUSALS_PER_WINDOW; refusal++) {
      act(() => {
        result.current.record("pm_link");
      });
      expect(result.current.pausedUntil).toBeNull();
      act(() => vi.advanceTimersByTime(MINUTE_MS));
    }
    act(() => {
      result.current.record();
    });

    expect(result.current.pausedUntil).toBe(firstRefusedAt + REFUSAL_WINDOW_MS);
  });

  it("ends the pause half an hour after the oldest refusal even when the clock stepped back between refusals", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:20:00Z") });
    const refusedAtMinutes = [15, 16, 17, 18, 5];
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        refusedAtMinutes.map(minute => ({
          userId: "user_1",
          paymentMethodId: "pm_link",
          refusedAt: Date.parse(`2026-11-02T10:${String(minute).padStart(2, "0")}:00Z`)
        }))
      )
    );

    const { result } = setup();

    expect(result.current.pausedUntil).toBe(Date.parse("2026-11-02T10:35:00Z"));
  });

  it("does not pause for refusals spread over more than half an hour", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup();

    act(() => {
      result.current.record("pm_link");
    });
    act(() => vi.advanceTimersByTime(REFUSAL_WINDOW_MS));
    for (let refusal = 1; refusal < MAX_REFUSALS_PER_WINDOW; refusal++) {
      act(() => {
        result.current.record("pm_link");
      });
    }

    expect(result.current.pausedUntil).toBeNull();
  });

  it("resumes payments once the pause ends", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup();
    for (let refusal = 0; refusal < MAX_REFUSALS_PER_WINDOW; refusal++) {
      act(() => {
        result.current.record("pm_link");
      });
    }

    act(() => vi.advanceTimersByTime(REFUSAL_WINDOW_MS - 1));
    expect(result.current.pausedUntil).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.pausedUntil).toBeNull();
  });

  it("resumes payments when the pause ends even if the wall clock reads a little earlier than the timer", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup();
    for (let refusal = 0; refusal < MAX_REFUSALS_PER_WINDOW; refusal++) {
      act(() => {
        result.current.record("pm_link");
      });
    }

    act(() => vi.advanceTimersByTime(REFUSAL_WINDOW_MS - 1));
    vi.setSystemTime(Date.now() - 5000);
    act(() => vi.advanceTimersByTime(1));

    expect(result.current.pausedUntil).toBeNull();
  });

  it("forgets the user's refusals and pause once cleared, but keeps other users' refusals", () => {
    const other = setup({ userId: "user_other" });
    act(() => {
      other.result.current.record("pm_link");
    });
    const { result } = setup();
    for (let refusal = 0; refusal < MAX_REFUSALS_PER_WINDOW; refusal++) {
      act(() => {
        result.current.record("pm_link");
      });
    }

    act(() => result.current.clear());

    expect(result.current.countFor("pm_link")).toBe(0);
    expect(result.current.pausedUntil).toBeNull();
    expect(setup({ userId: "user_other" }).result.current.countFor("pm_link")).toBe(1);
  });

  it("treats a payment method as refused repeatedly once this tab saw it refused often enough", () => {
    const { result } = setup();

    for (let refusal = 1; refusal < REFUSALS_PER_PAYMENT_METHOD; refusal++) {
      act(() => {
        result.current.record("pm_card");
      });
    }
    expect(result.current.isRefusedRepeatedly("pm_card")).toBe(false);

    act(() => {
      result.current.record("pm_card");
    });
    expect(result.current.isRefusedRepeatedly("pm_card")).toBe(true);
    expect(result.current.isRefusedRepeatedly("pm_other")).toBe(false);
  });

  it("treats a payment method the API reports as refused as refused repeatedly", () => {
    const { result } = setup({ userId: "user_1", recentRefusals: { refusedPaymentMethodIds: ["pm_card"], pausedUntil: null } });

    expect(result.current.isRefusedRepeatedly("pm_card")).toBe(true);
    expect(result.current.countFor("pm_card")).toBe(0);
    expect(result.current.isRefusedRepeatedly("pm_other")).toBe(false);
  });

  it("pauses payments while the API reports a pause, until it ends", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup({ userId: "user_1", recentRefusals: { refusedPaymentMethodIds: [], pausedUntil: "2026-11-02T10:10:00.000Z" } });

    expect(result.current.pausedUntil).toBe(Date.parse("2026-11-02T10:10:00Z"));

    act(() => vi.advanceTimersByTime(10 * MINUTE_MS));
    expect(result.current.pausedUntil).toBeNull();
  });

  it("ignores a pause the API reports that already ended", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup({ userId: "user_1", recentRefusals: { refusedPaymentMethodIds: [], pausedUntil: "2026-11-02T09:59:00.000Z" } });

    expect(result.current.pausedUntil).toBeNull();
  });

  it.each([
    ["the API's pause ends later", "2026-11-02T10:40:00.000Z", Date.parse("2026-11-02T10:40:00Z")],
    ["this tab's pause ends later", "2026-11-02T10:05:00.000Z", Date.parse("2026-11-02T10:30:00Z")]
  ])("keeps the later pause when %s", (_, recentPauseEnd, expectedPauseEnd) => {
    vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00Z") });
    const { result } = setup({ userId: "user_1", recentRefusals: { refusedPaymentMethodIds: [], pausedUntil: recentPauseEnd } });

    for (let refusal = 0; refusal < MAX_REFUSALS_PER_WINDOW; refusal++) {
      act(() => {
        result.current.record("pm_link");
      });
    }

    expect(result.current.pausedUntil).toBe(expectedPauseEnd);
  });

  it.each([
    ["is not JSON", "not json"],
    ["is not a list", JSON.stringify({ userId: "user_1" })]
  ])("starts empty when the stored value %s", (_, stored) => {
    window.sessionStorage.setItem(STORAGE_KEY, stored);

    const { result } = setup();

    expect(result.current.countFor("pm_link")).toBe(0);
  });

  it("keeps working when the browser refuses session storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = setup();

    act(() => {
      expect(result.current.record("pm_link")).toBe(1);
    });

    expect(result.current.countFor("pm_link")).toBe(1);
  });

  function setup(input: { userId?: string; recentRefusals?: RecentPaymentRefusals } = { userId: "user_1" }) {
    return renderHook(() => usePaymentRefusals(input.userId, input.recentRefusals));
  }
});

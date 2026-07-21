import { afterEach, describe, expect, it, vi } from "vitest";

import { useTopUpAttemptKey } from "./useTopUpAttemptKey";

import { renderHook } from "@testing-library/react";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_KEY = "add-credits-attempt";
const INPUT = { userId: "user_1", amount: 100, paymentMethodId: "pm_1" };

describe(useTopUpAttemptKey.name, () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("resolves a uuid attempt key", () => {
    const { result } = setup();

    expect(result.current.resolve(INPUT)).toMatch(UUID_PATTERN);
  });

  it("reuses the key while the purchase params are unchanged", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);

    expect(result.current.resolve(INPUT)).toBe(first);
  });

  it("rotates the key when the amount changes", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);

    expect(result.current.resolve({ ...INPUT, amount: 200 })).not.toBe(first);
  });

  it("rotates the key when the payment method changes", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);

    expect(result.current.resolve({ ...INPUT, paymentMethodId: "pm_2" })).not.toBe(first);
  });

  it("rotates the key when the user changes", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);

    expect(result.current.resolve({ ...INPUT, userId: "user_2" })).not.toBe(first);
  });

  it("mints a fresh key after the attempt is cleared", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);
    result.current.clear();

    expect(result.current.resolve(INPUT)).not.toBe(first);
  });

  it("rotates the key after a definitive 402 decline", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);
    result.current.clearIfConcluded({ response: { status: 402, data: { code: "card_declined" } } });

    expect(result.current.resolve(INPUT)).not.toBe(first);
  });

  it("rotates the key after a 409 idempotency-key mismatch", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);
    result.current.clearIfConcluded({ response: { status: 409, data: { code: "idempotency_key_mismatch" } } });

    expect(result.current.resolve(INPUT)).not.toBe(first);
  });

  it("keeps the key after a 409 conflict that is not a key mismatch", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);
    result.current.clearIfConcluded({ response: { status: 409, data: { code: "conflict" } } });

    expect(result.current.resolve(INPUT)).toBe(first);
  });

  it("keeps the key after an unknown-outcome failure", () => {
    const { result } = setup();

    const first = result.current.resolve(INPUT);
    result.current.clearIfConcluded({ response: { status: 500 } });
    result.current.clearIfConcluded(new Error("network down"));

    expect(result.current.resolve(INPUT)).toBe(first);
  });

  it("reuses a stored key that is still inside the 24h replay window", () => {
    const storedKey = "11111111-2222-4333-8444-555555555555";
    seedStoredAttempt({ key: storedKey, ageMs: 23 * 60 * 60 * 1000 });
    const { result } = setup();

    expect(result.current.resolve(INPUT)).toBe(storedKey);
  });

  it("ignores a stored key older than the 24h replay window", () => {
    const staleKey = "11111111-2222-4333-8444-555555555555";
    seedStoredAttempt({ key: staleKey, ageMs: 25 * 60 * 60 * 1000 });
    const { result } = setup();

    expect(result.current.resolve(INPUT)).not.toBe(staleKey);
  });

  it("replays the same key after a remount with identical params", () => {
    const first = setup();
    const key = first.result.current.resolve(INPUT);
    first.unmount();

    const second = setup();

    expect(second.result.current.resolve(INPUT)).toBe(key);
  });

  it("mints a fresh key when params differ after a remount", () => {
    const first = setup();
    const key = first.result.current.resolve(INPUT);
    first.unmount();

    const second = setup();

    expect(second.result.current.resolve({ ...INPUT, amount: 200 })).not.toBe(key);
  });

  it("returns a key even when sessionStorage writes throw", () => {
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const { result } = setup();

    expect(result.current.resolve(INPUT)).toMatch(UUID_PATTERN);
  });

  function seedStoredAttempt(input: { key: string; ageMs: number }) {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ key: input.key, amountCents: 10000, paymentMethodId: INPUT.paymentMethodId, userId: INPUT.userId, createdAt: Date.now() - input.ageMs })
    );
  }

  function setup() {
    return renderHook(() => useTopUpAttemptKey());
  }
});

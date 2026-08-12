import { describe, expect, it, vi } from "vitest";

import { retryWithBackoff } from "@src/lib/retry-with-backoff/retry-with-backoff";

describe(retryWithBackoff.name, () => {
  it("returns the result after a transient failure", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("transient")).mockResolvedValue("ok");
    const onRetry = vi.fn();

    const result = await retryWithBackoff(operation, { maxAttempts: 3, baseDelayMs: 1, onRetry });

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 1);
  });

  it("rethrows once the attempts are exhausted", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("persistent"));

    await expect(retryWithBackoff(operation, { maxAttempts: 3, baseDelayMs: 1, onRetry: vi.fn() })).rejects.toThrow("persistent");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("rethrows immediately when shouldRethrow matches", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("fatal"));

    await expect(retryWithBackoff(operation, { maxAttempts: 3, baseDelayMs: 1, shouldRethrow: () => true, onRetry: vi.fn() })).rejects.toThrow("fatal");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("caps the backoff delay at maxDelayMs", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("a")).mockRejectedValueOnce(new Error("b")).mockResolvedValue("ok");
    const onRetry = vi.fn();

    await retryWithBackoff(operation, { maxAttempts: 5, baseDelayMs: 2, maxDelayMs: 3, onRetry });

    expect(onRetry.mock.calls.map(call => call[2])).toEqual([2, 3]);
  });
});

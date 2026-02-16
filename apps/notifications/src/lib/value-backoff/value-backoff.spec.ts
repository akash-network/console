import { describe, expect, it, vi } from "vitest";

import { MESSAGE, valueBackoff } from "./value-backoff";

describe("valueBackoff", () => {
  it("should return value immediately when available on first attempt", async () => {
    const mockRequest = vi.fn().mockResolvedValue("success");

    const promise = valueBackoff(mockRequest);

    const result = await promise;
    expect(result).toBe("success");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("should retry until value is available", async () => {
    const mockRequest = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(undefined).mockResolvedValueOnce("success");

    const promise = valueBackoff(mockRequest, {
      numOfAttempts: 5,
      startingDelay: 10,
      maxDelay: 20
    });

    const result = await promise;
    expect(result).toBe("success");
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("should return null if request consistently returns null and safe option is provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue(null);

    const promise = valueBackoff(mockRequest, {
      numOfAttempts: 3,
      startingDelay: 10,
      maxDelay: 20,
      safe: true
    });

    const result = await promise;
    expect(result).toBeNull();
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("should return undefined if request consistently returns undefined and safe option is provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue(undefined);

    const promise = valueBackoff(mockRequest, {
      numOfAttempts: 3,
      startingDelay: 10,
      maxDelay: 20,
      safe: true
    });

    const result = await promise;
    expect(result).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("should throw if request consistently returns null and safe option is not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue(null);

    const promise = valueBackoff(mockRequest, {
      numOfAttempts: 3,
      startingDelay: 10,
      maxDelay: 20
    });

    await expect(promise).rejects.toThrow(MESSAGE);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("should throw if request consistently returns undefined and safe option is not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue(undefined);

    const promise = valueBackoff(mockRequest, {
      numOfAttempts: 3,
      startingDelay: 10,
      maxDelay: 20
    });

    await expect(promise).rejects.toThrow(MESSAGE);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("should reject with original error when request fails with non-empty error", async () => {
    const originalError = new Error("Original error");
    const mockRequest = vi.fn().mockRejectedValue(originalError);

    const promise = valueBackoff(mockRequest);

    await expect(promise).rejects.toThrow(originalError);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("should use provided backoff options", async () => {
    const mockRequest = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("success");

    const customOptions = {
      numOfAttempts: 2,
      startingDelay: 10,
      maxDelay: 100,
      timeMultiple: 3,
      jitter: "full" as const
    };

    const promise = valueBackoff(mockRequest, customOptions);

    const result = await promise;
    expect(result).toBe("success");
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});

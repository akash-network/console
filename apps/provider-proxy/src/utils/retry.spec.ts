import type { LoggerService } from "@akashnetwork/logging";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { canRetryOnError, httpRetry } from "./retry";

describe(httpRetry.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first response when it does not need a retry", async () => {
    const { logger } = setup();
    let calls = 0;
    async function connectToProvider() {
      calls++;
      return "ok";
    }

    const response = await httpRetry(connectToProvider, { retryIf: () => false, logger });

    expect(response).toBe("ok");
    expect(calls).toBe(1);
    expect(logger.info).toHaveBeenCalledWith({ event: "RUN_CALLBACK", attempt: 1, maxRetries: 3, callback: "connectToProvider" });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("names an anonymous callback by its source in logs", async () => {
    const { logger } = setup();

    await httpRetry(async () => "ok", { retryIf: () => false, logger });

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ callback: expect.stringContaining('=> "ok"') }));
  });

  it("waits 200, 400 and 800 ms before each retry of a response that needs one", async () => {
    setup();
    const callback = vi.fn(async () => "unavailable");

    const response = httpRetry(callback, { retryIf: () => true });

    await vi.advanceTimersByTimeAsync(199);
    expect(callback).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(399);
    expect(callback).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(799);
    expect(callback).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledTimes(4);
    await expect(response).resolves.toBe("unavailable");
  });

  it("returns the last response once retries run out", async () => {
    const { logger } = setup();
    const responses = ["first", "second", "third", "fourth", "fifth"];
    const callback = vi.fn(async () => responses.shift());

    const response = httpRetry(callback, { retryIf: () => true, logger });
    await vi.runAllTimersAsync();

    await expect(response).resolves.toBe("fourth");
    expect(callback).toHaveBeenCalledTimes(4);
    expect(logger.info).toHaveBeenLastCalledWith(expect.objectContaining({ event: "RUN_CALLBACK", attempt: 4, maxRetries: 3 }));
  });

  it("logs every retried response but not the final one", async () => {
    const { logger } = setup();

    const response = httpRetry(async () => "unavailable", { retryIf: () => true, logger });
    await vi.runAllTimersAsync();
    await response;

    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenNthCalledWith(3, expect.objectContaining({ event: "RUN_CALLBACK_FAILED", attempt: 3, maxRetries: 3, error: "Callback result requires retry" }));
  });

  it("stops retrying as soon as a response no longer needs it", async () => {
    setup();
    const responses = ["unavailable", "ok"];
    const callback = vi.fn(async () => responses.shift());

    const response = httpRetry(callback, { retryIf: response => response === "unavailable" });
    await vi.runAllTimersAsync();

    await expect(response).resolves.toBe("ok");
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("honors a custom number of retries", async () => {
    setup();
    const callback = vi.fn(async () => "unavailable");

    const response = httpRetry(callback, { retryIf: () => true, maxRetries: 1 });
    await vi.runAllTimersAsync();
    await response;

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("retries a retriable rejection and returns the next response", async () => {
    const { logger } = setup();
    const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const callback = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("ok");

    const response = httpRetry(callback, { retryIf: () => false, logger });
    await vi.runAllTimersAsync();

    await expect(response).resolves.toBe("ok");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "RUN_CALLBACK_FAILED", attempt: 1, error }));
  });

  it("rejects without retrying when the rejection is not retriable", async () => {
    const { logger } = setup();
    const error = new Error("boom");
    const callback = vi.fn().mockRejectedValue(error);

    const response = httpRetry(callback, { retryIf: () => false, logger });
    const rejection = expect(response).rejects.toThrow(expect.objectContaining({ message: "Fail to retry due to receiving non-retriable error", cause: error }));
    await vi.runAllTimersAsync();

    await rejection;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("rejects as not retriable when that rejection comes on the last allowed retry", async () => {
    setup();
    const retriable = Object.assign(new Error("reset"), { code: "ECONNRESET" });
    const error = new Error("boom");
    const callback = vi.fn().mockRejectedValueOnce(retriable).mockRejectedValueOnce(retriable).mockRejectedValueOnce(error);

    const response = httpRetry(callback, { retryIf: () => false });
    const rejection = expect(response).rejects.toThrow(expect.objectContaining({ message: "Fail to retry due to receiving non-retriable error", cause: error }));
    await vi.runAllTimersAsync();

    await rejection;
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("rejects with the last error once retriable rejections run out", async () => {
    setup();
    const error = Object.assign(new Error("refused"), { code: "ECONNREFUSED" });
    const callback = vi.fn().mockRejectedValue(error);

    const response = httpRetry(callback, { retryIf: () => false });
    const rejection = expect(response).rejects.toThrow(expect.objectContaining({ message: "Max retries reached: 3", cause: error }));
    await vi.runAllTimersAsync();

    await rejection;
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("keeps each caller's async context across retries of concurrent calls", async () => {
    const requestContext = new AsyncLocalStorage<string>();
    const seenContexts: Array<string | undefined> = [];
    const retryOnce = (requestId: string) =>
      requestContext.run(requestId, () =>
        httpRetry(
          async () => {
            seenContexts.push(`${requestId}:${requestContext.getStore()}`);
            return "unavailable";
          },
          { retryIf: () => true, maxRetries: 1 }
        )
      );

    await Promise.all([retryOnce("first"), retryOnce("second")]);

    expect(seenContexts.sort()).toEqual(["first:first", "first:first", "second:second", "second:second"]);
  });

  function setup() {
    vi.useFakeTimers();
    const logger = mock<LoggerService>();
    return { logger };
  }
});

describe(canRetryOnError.name, () => {
  it.each(["ECONNREFUSED", "ECONNRESET", "ERR_TLS_SESSION_REJECTED", "ETIMEDOUT", "ESOCKETTIMEDOUT"])("retries %s", code => {
    expect(canRetryOnError(Object.assign(new Error(code), { code }))).toBe(true);
  });

  it("does not retry other error codes", () => {
    expect(canRetryOnError(Object.assign(new Error("not found"), { code: "ENOTFOUND" }))).toBe(false);
  });

  it("reads the code from the error cause chain", () => {
    const cause = Object.assign(new Error("reset"), { code: "ECONNRESET" });

    expect(canRetryOnError(new Error("request failed", { cause }))).toBe(true);
  });

  it("does not retry a missing error", () => {
    expect(canRetryOnError(undefined)).toBe(false);
  });
});

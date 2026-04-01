import { BrokenCircuitError } from "cockatiel";
import { setTimeout as wait } from "timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpAdapter, HttpResponse } from "../../http/http.types";
import { HttpError } from "../../http/http-error";
import { createFetchAdapter } from "./createFetchAdapter";

function makeConfig(overrides: Partial<Parameters<HttpAdapter>[0]> = {}): Parameters<HttpAdapter>[0] {
  return { method: "GET", url: "/test", headers: {}, ...overrides };
}

function makeHttpError(status: number, config: Parameters<HttpAdapter>[0], responseHeaders: Record<string, string> = {}): HttpError {
  const response: HttpResponse = {
    data: {},
    status,
    statusText: "test",
    headers: responseHeaders,
    config
  };
  return new HttpError("test", String(status), config, response);
}

describe(createFetchAdapter.name, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("retries", () => {
    it("retries request 3 times if it fails with 5xx", async () => {
      const adapter = vi
        .fn()
        .mockImplementationOnce(async (config: Parameters<HttpAdapter>[0]) => {
          throw makeHttpError(500, config);
        })
        .mockImplementation(async () => ({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} }));

      const fetch = createFetchAdapter({
        adapter
      });

      const [result] = await Promise.all([fetch(makeConfig()), vi.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual("test");
    });

    it("retries request 3 times if it fails with 429", async () => {
      const adapter = vi
        .fn()
        .mockImplementationOnce(async (config: Parameters<HttpAdapter>[0]) => {
          throw makeHttpError(429, config);
        })
        .mockImplementation(async () => ({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} }));

      const fetch = createFetchAdapter({
        adapter
      });

      const [result] = await Promise.all([fetch(makeConfig()), vi.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual("test");
    });

    it("does not retry request if it fails with 400", async () => {
      const adapter = vi.fn().mockImplementationOnce(async (config: Parameters<HttpAdapter>[0]) => {
        throw makeHttpError(400, config);
      });

      const fetch = createFetchAdapter({
        adapter
      });

      const [result] = await Promise.all([fetch(makeConfig()).catch(error => error as HttpError), vi.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(1);
      expect(result.status).toEqual(400);
    });

    it("respects numeric retry-after header", async () => {
      const adapter = vi
        .fn()
        .mockImplementationOnce(async (config: Parameters<HttpAdapter>[0]) => {
          throw makeHttpError(500, config, { "retry-after": "60" });
        })
        .mockImplementation(async () => ({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} }));

      const fetch = createFetchAdapter({
        adapter
      });

      const start = Date.now();
      const [result] = await Promise.all([fetch(makeConfig()), vi.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(Date.now() - start).toBeGreaterThanOrEqual(60 * 1000);
      expect(result.data).toEqual("test");
    });

    it("respects date retry-after header", async () => {
      const adapter = vi
        .fn()
        .mockImplementationOnce(async (config: Parameters<HttpAdapter>[0]) => {
          throw makeHttpError(500, config, { "retry-after": new Date(Date.now() + 60 * 1000).toUTCString() });
        })
        .mockImplementation(async () => ({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} }));

      const fetch = createFetchAdapter({
        adapter
      });

      const start = Date.now();
      const [result] = await Promise.all([fetch(makeConfig()), vi.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(Date.now() - start).toBeGreaterThanOrEqual(60 * 1000);
      expect(result.data).toEqual("test");
    });
  });

  describe("circuit breaker", () => {
    it("opens the circuit breaker if it fails 3 times", async () => {
      const adapter = vi.fn().mockImplementation(async (config: Parameters<HttpAdapter>[0]) => {
        throw makeHttpError(500, config);
      });

      const fetch = createFetchAdapter({
        adapter,
        circuitBreaker: {
          maxAttempts: 1
        }
      });

      await Promise.all([fetch(makeConfig()).catch(error => error as HttpError), vi.runAllTimersAsync()]);

      await expect(fetch(makeConfig())).rejects.toThrow(BrokenCircuitError);
      expect(adapter).toHaveBeenCalledTimes(4);
    });

    it("closes the circuit breaker after halfOpenAfter it succeeds", async () => {
      const adapter = vi.fn().mockImplementation(async (config: Parameters<HttpAdapter>[0]) => {
        throw makeHttpError(500, config);
      });

      const fetch = createFetchAdapter({
        adapter,
        circuitBreaker: {
          halfOpenAfter: 1000
        }
      });

      await Promise.all([fetch(makeConfig()).catch(error => error as HttpError), vi.runAllTimersAsync()]);

      await expect(fetch(makeConfig())).rejects.toThrow(BrokenCircuitError);

      adapter.mockImplementationOnce(async () => ({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} }));
      vi.advanceTimersByTime(30 * 1000);

      expect(await fetch(makeConfig())).toEqual({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} });
    });

    it("calls onSuccess callback when request succeeds", async () => {
      const adapter = vi.fn().mockImplementation(async () => ({ status: 200, data: "test", statusText: "OK", headers: {}, config: {} }));
      const onSuccess = vi.fn();
      const fetch = createFetchAdapter({
        adapter,
        onSuccess
      });

      await fetch(makeConfig());

      expect(adapter).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("calls onFailure callback when request finally fails", async () => {
      const adapter = vi.fn().mockImplementation(async (config: Parameters<HttpAdapter>[0]) => {
        throw makeHttpError(500, config);
      });
      const onFailure = vi.fn();
      const fetch = createFetchAdapter({
        adapter,
        onFailure
      });

      await Promise.all([fetch(makeConfig()).catch(error => error as HttpError), vi.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(4);
      expect(onFailure).toHaveBeenCalledTimes(1);
    });
  });

  describe("abortPendingWhenOneFail", () => {
    it("aborts all pending requests when one request fails with matching condition", async () => {
      let i = 0;
      const adapter = vi.fn().mockImplementation(async (config: Parameters<HttpAdapter>[0]) => {
        await wait(i * 100, undefined, { signal: config.signal as AbortSignal });
        i += 2;
        throw makeHttpError(401, config);
      });

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      const failingRequest = fetch(makeConfig({ url: "/failing" }));
      const pendingRequest = fetch(makeConfig({ url: "/pending" }));

      const [pendingResult, failingResult] = await Promise.allSettled([pendingRequest, failingRequest]);

      expect(pendingResult.status).toBe("rejected");
      const abortError = (pendingResult as unknown as PromiseRejectedResult).reason;
      expect(abortError.name).toBe("AbortError");

      expect(failingResult.status).toBe("rejected");
      const error = (failingResult as unknown as PromiseRejectedResult).reason;
      expect(error.response?.status).toBe(401);
    });

    it("allows new requests after abort", async () => {
      let callCount = 0;
      const adapter = vi.fn().mockImplementation(async (config: Parameters<HttpAdapter>[0]) => {
        callCount++;
        if (callCount === 1) {
          throw makeHttpError(401, config);
        }
        return { status: 200, data: "success", statusText: "OK", headers: {}, config: {} };
      });

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      await expect(fetch(makeConfig({ url: "/first" }))).rejects.toThrow();

      const result = await fetch(makeConfig({ url: "/second" }));
      expect(result.data).toBe("success");
    });

    it("does not abort requests when condition does not match", async () => {
      const adapter = vi.fn().mockImplementation(async (config: Parameters<HttpAdapter>[0]) => {
        if (config.url === "/failing") {
          throw makeHttpError(400, config);
        }
        return { status: 200, data: "success", statusText: "OK", headers: {}, config: {} };
      });

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      const failingPromise = fetch(makeConfig({ url: "/failing" })).catch((error: HttpError) => error);
      const successPromise = fetch(makeConfig({ url: "/success" }));

      const [failingResult, successResult] = await Promise.all([failingPromise, successPromise]);

      expect((failingResult as HttpError).response?.status).toBe(400);
      expect(successResult.data).toBe("success");
    });

    it("preserves existing signal when provided", async () => {
      const externalAbortController = new AbortController();
      const adapter = vi.fn().mockImplementation(async () => ({ status: 200, data: "success", statusText: "OK", headers: {}, config: {} }));

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      await fetch(makeConfig({ signal: externalAbortController.signal }));

      expect(adapter).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );

      const passedConfig = adapter.mock.calls[0][0] as Parameters<HttpAdapter>[0];
      expect(passedConfig.signal).not.toBe(externalAbortController.signal);
    });
  });
});

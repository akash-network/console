import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError, AxiosHeaders } from "axios";
import { BrokenCircuitError } from "cockatiel";
import { setTimeout as wait } from "timers/promises";

import { createFetchAdapter } from "./createFetchAdapter";

describe(createFetchAdapter.name, () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("retries", () => {
    it("retries request 3 times if it fails with 5xx", async () => {
      const adapter = jest
        .fn()
        .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
          throw new AxiosError(
            "test",
            "500",
            config,
            {},
            {
              status: 500,
              statusText: "test",
              headers: {},
              data: {},
              config
            }
          );
        })
        .mockImplementation(async () => ({ status: 200, data: "test" }));

      const fetch = createFetchAdapter({
        adapter
      });

      const [result] = await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }), jest.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual("test");
    });

    it("retries request 3 times if it fails with 429", async () => {
      const adapter = jest
        .fn()
        .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
          throw new AxiosError(
            "test",
            "500",
            config,
            {},
            {
              status: 429,
              statusText: "test",
              headers: {},
              data: {},
              config
            }
          );
        })
        .mockImplementation(async () => ({ status: 200, data: "test" }));

      const fetch = createFetchAdapter({
        adapter
      });

      const [result] = await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }), jest.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual("test");
    });

    it("does not retry request if it fails with 400", async () => {
      const adapter = jest.fn().mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
          "test",
          "500",
          config,
          {},
          {
            status: 400,
            statusText: "test",
            headers: {},
            data: {},
            config
          }
        );
      });

      const fetch = createFetchAdapter({
        adapter
      });

      const [result] = await Promise.all([
        fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }).catch(error => error as AxiosError),
        jest.runAllTimersAsync()
      ]);

      expect(adapter).toHaveBeenCalledTimes(1);
      expect(result.status).toEqual(400);
    });

    it("respects numeric retry-after header", async () => {
      const adapter = jest
        .fn()
        .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
          throw new AxiosError(
            "test",
            "500",
            config,
            {},
            {
              status: 500,
              statusText: "test",
              headers: { "retry-after": "60" },
              data: {},
              config
            }
          );
        })
        .mockImplementation(async () => ({ status: 200, data: "test" }));

      const fetch = createFetchAdapter({
        adapter
      });

      const start = Date.now();
      const [result] = await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }), jest.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(Date.now() - start).toBeGreaterThanOrEqual(60 * 1000);
      expect(result.data).toEqual("test");
    });

    it("respects date retry-after header", async () => {
      const adapter = jest
        .fn()
        .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
          throw new AxiosError(
            "test",
            "500",
            config,
            {},
            {
              status: 500,
              statusText: "test",
              headers: { "retry-after": new Date(Date.now() + 60 * 1000).toUTCString() },
              data: {},
              config
            }
          );
        })
        .mockImplementation(async () => ({ status: 200, data: "test" }));

      const fetch = createFetchAdapter({
        adapter
      });

      const start = Date.now();
      const [result] = await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }), jest.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(2);
      expect(Date.now() - start).toBeGreaterThanOrEqual(60 * 1000);
      expect(result.data).toEqual("test");
    });
  });

  describe("circuit breaker", () => {
    it("opens the circuit breaker if it fails 3 times", async () => {
      const adapter = jest.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
          "test",
          "500",
          config,
          {},
          {
            status: 500,
            statusText: "test",
            headers: {},
            data: {},
            config
          }
        );
      });

      const fetch = createFetchAdapter({
        adapter,
        circuitBreaker: {
          maxAttempts: 1
        }
      });

      await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }).catch(error => error as AxiosError), jest.runAllTimersAsync()]);

      await expect(fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() })).rejects.toThrow(BrokenCircuitError);
      expect(adapter).toHaveBeenCalledTimes(4);
    });

    it("closes the circuit breaker after halfOpenAfter it succeeds", async () => {
      const adapter = jest.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
          "test",
          "500",
          config,
          {},
          {
            status: 500,
            statusText: "test",
            headers: {},
            data: {},
            config
          }
        );
      });

      const fetch = createFetchAdapter({
        adapter,
        circuitBreaker: {
          halfOpenAfter: 1000
        }
      });

      await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }).catch(error => error as AxiosError), jest.runAllTimersAsync()]);

      await expect(fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() })).rejects.toThrow(BrokenCircuitError);

      adapter.mockImplementationOnce(async () => ({ status: 200, data: "test" }));
      jest.advanceTimersByTime(30 * 1000);

      expect(await fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() })).toEqual({ status: 200, data: "test" });
    });

    it("calls onSuccess callback when request succeeds", async () => {
      const adapter = jest.fn().mockImplementation(async () => ({ status: 200, data: "test" }));
      const onSuccess = jest.fn();
      const fetch = createFetchAdapter({
        adapter,
        onSuccess
      });

      await fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() });

      expect(adapter).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("calls onFailure callback when request finally fails", async () => {
      const adapter = jest.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
          "test",
          "500",
          config,
          {},
          {
            status: 500,
            statusText: "test",
            headers: {},
            data: {},
            config
          }
        );
      });
      const onFailure = jest.fn();
      const fetch = createFetchAdapter({
        adapter,
        onFailure
      });

      await Promise.all([fetch({ method: "GET", url: "/test", headers: new AxiosHeaders() }).catch(error => error as AxiosError), jest.runAllTimersAsync()]);

      expect(adapter).toHaveBeenCalledTimes(4);
      expect(onFailure).toHaveBeenCalledTimes(1);
    });
  });

  describe("abortPendingWhenOneFail", () => {
    it("aborts all pending requests when one request fails with matching condition", async () => {
      let i = 0;
      const adapter = jest.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
        await wait(i * 100, undefined, { signal: config.signal as AbortSignal });
        i += 2;
        throw new AxiosError(
          "Unauthorized",
          "401",
          config,
          {},
          {
            status: 401,
            statusText: "Unauthorized",
            headers: {},
            data: {},
            config
          }
        );
      });

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      const failingRequest = fetch({ method: "GET", url: "/failing", headers: new AxiosHeaders() });
      const pendingRequest = fetch({ method: "GET", url: "/pending", headers: new AxiosHeaders() });

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
      const adapter = jest.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
        callCount++;
        if (callCount === 1) {
          throw new AxiosError(
            "Unauthorized",
            "401",
            config,
            {},
            {
              status: 401,
              statusText: "Unauthorized",
              headers: {},
              data: {},
              config
            }
          );
        }
        return { status: 200, data: "success" };
      });

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      await expect(fetch({ method: "GET", url: "/first", headers: new AxiosHeaders() })).rejects.toThrow();

      const result = await fetch({ method: "GET", url: "/second", headers: new AxiosHeaders() });
      expect(result.data).toBe("success");
    });

    it("does not abort requests when condition does not match", async () => {
      const adapter = jest.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.url === "/failing") {
          throw new AxiosError(
            "Bad Request",
            "400",
            config,
            {},
            {
              status: 400,
              statusText: "Bad Request",
              headers: {},
              data: {},
              config
            }
          );
        }
        return { status: 200, data: "success" };
      });

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      const failingPromise = fetch({ method: "GET", url: "/failing", headers: new AxiosHeaders() }).catch((error: AxiosError) => error);
      const successPromise = fetch({ method: "GET", url: "/success", headers: new AxiosHeaders() });

      const [failingResult, successResult] = await Promise.all([failingPromise, successPromise]);

      expect((failingResult as AxiosError).response?.status).toBe(400);
      expect(successResult.data).toBe("success");
    });

    it("preserves existing signal when provided", async () => {
      const externalAbortController = new AbortController();
      const adapter = jest.fn().mockImplementation(async () => ({ status: 200, data: "success" }));

      const fetch = createFetchAdapter({
        adapter,
        abortPendingWhenOneFail: response => response.status === 401,
        retries: 1
      });

      await fetch({ method: "GET", url: "/test", headers: new AxiosHeaders(), signal: externalAbortController.signal });

      expect(adapter).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );

      const passedConfig = adapter.mock.calls[0][0] as InternalAxiosRequestConfig;
      expect(passedConfig.signal).not.toBe(externalAbortController.signal);
    });
  });
});

import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError, AxiosHeaders } from "axios";
import { BrokenCircuitError } from "cockatiel";

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
        adapter
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
});

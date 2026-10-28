import type { LoggerService } from "@akashnetwork/logging";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ErrorHandlerService, sentryTraceToW3C } from "./error-handler.service";

describe(ErrorHandlerService.name, () => {
  it("handles generic error without extra metadata", () => {
    const captureException = vi.fn().mockReturnValue("event-id-1");
    const logger = mock<LoggerService>();
    const errorHandler = setup({ captureException, logger });
    const error = new Error("Generic error");

    errorHandler.reportError({ error, tags: { category: "test", event: "TEST_ERROR" }, message: "test message" });

    expect(captureException).toHaveBeenCalledWith(error, {
      extra: { message: "test message" },
      level: "error",
      tags: { category: "test", event: "TEST_ERROR" }
    });
    expect(logger.error).toHaveBeenCalledWith({ error, category: "test", event: "TEST_ERROR", message: "test message" });
  });

  it("handles HTTP error with response metadata", () => {
    const captureException = vi.fn().mockReturnValue("event-id-2");
    const errorHandler = setup({ captureException });

    const config = {
      method: "get",
      url: "https://api.example.com/users"
    } as InternalAxiosRequestConfig;
    const httpError = new AxiosError(
      "Request failed",
      "400",
      config,
      {},
      {
        status: 404,
        statusText: "Not Found",
        headers: {
          "content-type": "application/json",
          "x-request-id": "123-456-789"
        },
        data: {},
        config: config
      }
    );

    errorHandler.reportError({ error: httpError });

    expect(captureException).toHaveBeenCalledWith(httpError, {
      level: "error",
      extra: {
        headers: {
          "content-type": "application/json",
          "x-request-id": "123-456-789"
        }
      },
      tags: {
        status: "404",
        method: "GET",
        url: "https://api.example.com/users"
      }
    });
  });

  it.each([
    ["a DOM abort", { name: "AbortError" }],
    ["an axios cancellation by name", { name: "CanceledError" }],
    ["an axios cancellation by code", { code: "ERR_CANCELED" }],
    ["a Monaco cancellation", { name: "Canceled" }]
  ])("does not report %s", (_label, shape) => {
    const captureException = vi.fn();
    const errorHandler = setup({ captureException });

    errorHandler.reportError({ error: Object.assign(new Error("cancelled"), shape) });

    expect(captureException).not.toHaveBeenCalled();
  });

  it("tags http errors that responded 400", () => {
    const captureException = vi.fn();
    const errorHandler = setup({ captureException });
    const config = { method: "post", url: "https://api.example.com/deployments" } as InternalAxiosRequestConfig;
    const httpError = new AxiosError("Request failed", "400", config, {}, { status: 400, statusText: "Bad Request", headers: {}, data: {}, config });

    errorHandler.reportError({ error: httpError });

    expect(captureException).toHaveBeenCalledWith(
      httpError,
      expect.objectContaining({ tags: { status: "400", method: "POST", url: "https://api.example.com/deployments" } })
    );
  });

  describe("when the CDN refuses a request with its own page", () => {
    it.each([
      ["a 403 page from an axios call", () => buildAxiosError({ status: 403, contentType: "text/html; charset=UTF-8" })],
      ["a 429 page from an axios call", () => buildAxiosError({ status: 429, contentType: "text/html" })],
      ["a 403 page from an api call", () => new ApiError(403, '<!DOCTYPE html><html lang="en-US"></html>', "GET /v1/activities → 403")],
      ["a 429 page from an api call", () => new ApiError(429, "<HTML><BODY></BODY></HTML>", "GET /v1/activities → 429")]
    ])("reports %s once per page under one fingerprint", (_label, buildError) => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });

      errorHandler.reportError({ error: buildError() });
      errorHandler.reportError({ error: buildError() });

      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fingerprint: ["edge-refusal"] }));
    });

    it("keeps reporting other errors after an edge refusal", () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const error = new Error("unrelated");

      errorHandler.reportError({ error: buildAxiosError({ status: 403, contentType: "text/html" }) });
      errorHandler.reportError({ error });

      expect(captureException).toHaveBeenCalledTimes(2);
      expect(captureException).toHaveBeenLastCalledWith(error, { level: "error", extra: {}, tags: {} });
    });

    it.each([
      ["a 403 the api answered in json through axios", () => buildAxiosError({ status: 403, contentType: "application/json" })],
      ["a 500 page from an axios call", () => buildAxiosError({ status: 500, contentType: "text/html" })],
      ["an axios call that never got a response", () => new AxiosError("Network Error", "ERR_NETWORK", requestConfig())],
      ["a 403 the api answered in json", () => new ApiError(403, { code: "FORBIDDEN" }, "GET /v1/activities → 403")],
      ["a 403 the api answered in plain text", () => new ApiError(403, "Forbidden", "GET /v1/activities → 403")],
      ["a 500 page from an api call", () => new ApiError(500, "<html><body></body></html>", "GET /v1/activities → 500")]
    ])("reports %s every time without the edge fingerprint", (_label, buildError) => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });

      errorHandler.reportError({ error: buildError() });
      errorHandler.reportError({ error: buildError() });

      expect(captureException).toHaveBeenCalledTimes(2);
      expect(captureException.mock.calls[1][1]).not.toHaveProperty("fingerprint");
    });
  });

  describe("wrapCallback", () => {
    it("wraps synchronous function and reports error", () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const error = new Error("test error");
      const fn = () => {
        throw error;
      };

      const wrapped = errorHandler.wrapCallback(fn, {
        tags: { category: "test" }
      });

      wrapped();

      expect(captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          extra: {},
          tags: { category: "test" }
        })
      );
    });

    it("wraps async function and reports error", async () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const error = new Error("test error");
      const fn = async () => {
        throw error;
      };

      const wrapped = errorHandler.wrapCallback(fn, {
        tags: { category: "test" }
      });

      await wrapped();

      expect(captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { category: "test" }
        })
      );
    });

    it("returns fallback value when provided", () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const error = new Error("test error");
      const fn = (): string => {
        throw error;
      };
      const fallbackValue = () => "fallback";

      const wrapped = errorHandler.wrapCallback(fn, {
        tags: { category: "test" },
        fallbackValue
      });

      const result = wrapped();

      expect(result).toBe("fallback");
      expect(captureException).toHaveBeenCalledWith(error, {
        extra: {},
        level: "error",
        tags: { category: "test" }
      });
    });

    it("returns fallback value for async function when provided", async () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const error = new Error("test error");
      const fn = async (): Promise<string> => {
        throw error;
      };
      const fallbackValue = async () => "fallback";

      const wrapped = errorHandler.wrapCallback(fn, {
        tags: { category: "test" },
        fallbackValue
      });

      const result = await wrapped();

      expect(result).toBe("fallback");
      expect(captureException).toHaveBeenCalledWith(error, {
        extra: {},
        level: "error",
        tags: { category: "test" }
      });
    });

    it("passes through return value when no error occurs", () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const fn = () => "success";

      const wrapped = errorHandler.wrapCallback(fn);

      const result = wrapped();

      expect(result).toBe("success");
      expect(captureException).not.toHaveBeenCalled();
    });

    it("passes through return value when no error occurs in async function", async () => {
      const captureException = vi.fn();
      const errorHandler = setup({ captureException });
      const fn = async () => "success";

      const wrapped = errorHandler.wrapCallback(fn);

      const result = await wrapped();

      expect(result).toBe("success");
      expect(captureException).not.toHaveBeenCalled();
    });
  });

  describe(sentryTraceToW3C.name, () => {
    it("converts sentry-trace to W3C traceparent with 00 flags when sampled is 0", () => {
      const sentryTrace = "15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-0";
      expect(sentryTraceToW3C(sentryTrace)).toBe("00-15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-00");
    });

    it("converts sentry-trace to W3C traceparent with 01 flags when sampled is 1", () => {
      const sentryTrace = "15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-1";
      expect(sentryTraceToW3C(sentryTrace)).toBe("00-15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-01");
    });

    it("returns undefined for invalid values", () => {
      expect(sentryTraceToW3C("")).toBeUndefined();
      expect(sentryTraceToW3C("15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08")).toBe("00-15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-00");
      expect(sentryTraceToW3C("00000000000000000000000000000000-8ab28c3adec47f08-1")).toBeUndefined();
      expect(sentryTraceToW3C("15b857440fc54a828dbbc2e934f54b6e-0000000000000000-1")).toBeUndefined();
    });

    it("ignores extra suffixes after the sampled flag", () => {
      const sentryTrace = "15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-1-foo";
      expect(sentryTraceToW3C(sentryTrace)).toBe("00-15b857440fc54a828dbbc2e934f54b6e-8ab28c3adec47f08-01");
    });
  });

  function requestConfig() {
    return { method: "get", url: "v1/wallets" } as InternalAxiosRequestConfig;
  }

  function buildAxiosError(input: { status: number; contentType: string }) {
    const config = requestConfig();
    return new AxiosError(
      "Request failed",
      undefined,
      config,
      {},
      { status: input.status, statusText: "", headers: { "content-type": input.contentType }, data: "", config }
    );
  }

  function setup(input?: { captureException?: (error: unknown, context?: any) => string; logger?: LoggerService }) {
    const captureException = input?.captureException || vi.fn().mockReturnValue("mock-event-id");
    return new ErrorHandlerService(input?.logger || mock<LoggerService>(), captureException);
  }
});

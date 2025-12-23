import type { LoggerService } from "@akashnetwork/logging";
import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { mock } from "jest-mock-extended";

import { ErrorHandlerService, sentryTraceToW3C } from "./error-handler.service";

describe(ErrorHandlerService.name, () => {
  it("handles generic error without extra metadata", () => {
    const captureException = jest.fn().mockReturnValue("event-id-1");
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
    const captureException = jest.fn().mockReturnValue("event-id-2");
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

  describe("wrapCallback", () => {
    it("wraps synchronous function and reports error", () => {
      const captureException = jest.fn();
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
      const captureException = jest.fn();
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
      const captureException = jest.fn();
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
      const captureException = jest.fn();
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
      const captureException = jest.fn();
      const errorHandler = setup({ captureException });
      const fn = () => "success";

      const wrapped = errorHandler.wrapCallback(fn);

      const result = wrapped();

      expect(result).toBe("success");
      expect(captureException).not.toHaveBeenCalled();
    });

    it("passes through return value when no error occurs in async function", async () => {
      const captureException = jest.fn();
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

  function setup(input?: { captureException?: (error: unknown, context?: any) => string; logger?: LoggerService }) {
    const captureException = input?.captureException || jest.fn().mockReturnValue("mock-event-id");
    return new ErrorHandlerService(input?.logger || mock<LoggerService>(), captureException);
  }
});

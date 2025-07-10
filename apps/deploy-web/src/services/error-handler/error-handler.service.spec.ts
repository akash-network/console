import type { LoggerService } from "@akashnetwork/logging";
import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { mock } from "jest-mock-extended";

import { ErrorHandlerService } from "./error-handler.service";

describe(ErrorHandlerService.name, () => {
  it("handles generic error without extra metadata", () => {
    const captureException = jest.fn().mockReturnValue("event-id-1");
    const logger = mock<LoggerService>();
    const errorHandler = setup({ captureException, logger });
    const error = new Error("Generic error");

    errorHandler.reportError({ error, tags: { category: "test", event: "TEST_ERROR" }, message: "test message" });

    expect(captureException).toHaveBeenCalledWith(error, {
      extra: { message: "test message" },
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

  function setup(input?: { captureException?: (error: unknown, context?: any) => string; logger?: LoggerService }) {
    const captureException = input?.captureException || jest.fn().mockReturnValue("mock-event-id");
    return new ErrorHandlerService(input?.logger || mock<LoggerService>(), captureException);
  }
});

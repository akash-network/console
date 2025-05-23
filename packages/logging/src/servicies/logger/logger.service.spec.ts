import createHttpError from "http-errors";
import { Transform } from "node:stream";
import type { LoggerOptions } from "pino";
import pino from "pino";

import { config } from "../../config";
import type { Logger } from "./logger.service";
import { LoggerService } from "./logger.service";

jest.mock("pino");

describe("LoggerService", () => {
  const defaultLogFormat = config.STD_OUT_LOG_FORMAT;
  const COMMON_EXPECTED_OPTIONS: LoggerOptions = {
    level: "info",
    mixin: undefined,
    timestamp: expect.any(Function),
    formatters: {
      level: expect.any(Function)
    }
  };

  afterEach(() => {
    config.STD_OUT_LOG_FORMAT = defaultLogFormat;
    jest.clearAllMocks();
  });

  describe("prototype.initPino", () => {
    it("should initialize pino with pretty formatting when STD_OUT_LOG_FORMAT is 'pretty'", () => {
      config.STD_OUT_LOG_FORMAT = "pretty";
      new LoggerService();

      expect(pino).toHaveBeenCalledWith(COMMON_EXPECTED_OPTIONS, expect.any(Transform));
    });

    it("should initialize pino without pretty formatting for other formats", () => {
      config.STD_OUT_LOG_FORMAT = "json";
      new LoggerService();

      expect(pino).toHaveBeenCalledWith(COMMON_EXPECTED_OPTIONS);
    });

    it("should initialize pino with global mixin", () => {
      function globalMixin() {
        return {};
      }
      LoggerService.mixin = globalMixin;
      new LoggerService();

      expect(pino).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, mixin: globalMixin });

      LoggerService.mixin = undefined;
    });

    it("should initialize pino with local mixin overriding global mixin", () => {
      function globalMixin() {
        return {};
      }
      function localMixin() {
        return {};
      }
      LoggerService.mixin = globalMixin;
      new LoggerService({ mixin: localMixin });

      expect(pino).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, mixin: localMixin });

      LoggerService.mixin = undefined;
    });

    it("should initialize pino with provided log level overriding global log level", () => {
      new LoggerService({ level: "debug" });

      expect(pino).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, level: "debug" });

      LoggerService.mixin = undefined;
    });
  });

  describe("methods", () => {
    let loggerService: LoggerService;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnThis()
      } as unknown as jest.Mocked<Logger>;

      (pino as unknown as jest.Mock).mockReturnValue(mockLogger);
      loggerService = new LoggerService();
    });

    const methods: (keyof Logger)[] = ["info", "error", "warn", "debug"];
    describe.each(methods)("prototype.%s", method => {
      const logMessage = "Test message";

      it(`should call pino.${method} on info method`, () => {
        loggerService[method](logMessage);
        expect(mockLogger[method]).toHaveBeenCalledWith(logMessage);
      });
    });

    describe("prototype.toLoggableInput", () => {
      it("should return detailed information about HttpError", () => {
        const httpError = createHttpError(404, {
          status: 404,
          message: "Not found",
          stack: "stack trace",
          data: { key: "value" }
        });

        const loggable = loggerService["toLoggableInput"](httpError);
        expect(loggable).toEqual({
          status: 404,
          message: "Not found",
          stack: "stack trace",
          data: { key: "value" }
        });
      });

      it("should return detailed stack trace information about cause, errors, and original error for HttpError", () => {
        const httpError = createHttpError(404, {
          status: 404,
          message: "Not found",
          stack: "stack trace",
          data: { key: "value" },
          originalError: new Error("Original error"),
          cause: new Error("Cause error")
        });

        const loggable = loggerService["toLoggableInput"](httpError);
        expect(loggable).toEqual({
          status: 404,
          message: "Not found",
          stack: expect.stringContaining("stack trace\n\nCaused by:\n  Error: Cause error"),
          data: { key: "value" },
          originalError: expect.stringContaining("Error: Original error")
        });
      });

      it("should return cause for HttpError", () => {
        const httpError = createHttpError(404, {
          status: 404,
          message: "Not found",
          stack: "stack trace",
          data: { key: "value" },
          originalError: new Error("Original error")
        });

        const loggable = loggerService["toLoggableInput"](httpError);
        expect(loggable).toEqual({
          status: 404,
          message: "Not found",
          stack: "stack trace",
          data: { key: "value" },
          originalError: expect.stringContaining("Error: Original error")
        });
      });

      it("should include error cause in stack trace for Error instance", () => {
        const error = new Error("Test error");
        Object.assign(error, { cause: new Error("Cause error") });
        const loggable = loggerService["toLoggableInput"](error);

        expect(loggable).toContain("Cause error");
        expect(loggable).toContain("Test error");
      });

      it("should return stack for general Error instance", () => {
        const error = new Error("Test error");
        const loggable = loggerService["toLoggableInput"](error);
        expect(loggable).toBe(error.stack);
      });

      it("should return the original message if it is not an error", () => {
        const message = "Test message";
        const loggable = loggerService["toLoggableInput"](message);
        expect(loggable).toBe(message);
      });

      it('should return stack trace for "error" and "err" property in object', () => {
        const error = new Error("Test error");
        Object.assign(error, { cause: new Error("Cause error") });

        let loggable = loggerService["toLoggableInput"]({ error });
        expect(loggable.error).toContain("Test error");
        expect(loggable.error).toContain("Cause error");

        loggable = loggerService["toLoggableInput"]({ err: error });
        expect(loggable.err).toContain("Test error");
        expect(loggable.err).toContain("Cause error");
      });
    });
  });
});

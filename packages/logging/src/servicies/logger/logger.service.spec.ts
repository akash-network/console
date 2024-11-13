import createHttpError from "http-errors";
import pino from "pino";
import { gcpLogOptions } from "pino-cloud-logging";

import { config } from "../../config";
import { Logger, LoggerService } from "./logger.service";

jest.mock("pino");
jest.mock("pino-cloud-logging");

(gcpLogOptions as jest.Mock).mockImplementation(options => options);

describe("LoggerService", () => {
  const defaultLogFormat = config.STD_OUT_LOG_FORMAT;

  afterEach(() => {
    config.STD_OUT_LOG_FORMAT = defaultLogFormat;
    jest.clearAllMocks();
  });

  describe("prototype.initPino", () => {
    it("should initialize pino with pretty formatting when STD_OUT_LOG_FORMAT is 'pretty'", () => {
      config.STD_OUT_LOG_FORMAT = "pretty";
      new LoggerService();

      expect(pino).toHaveBeenCalledWith({
        level: "info",
        mixin: undefined,
        transport: { target: "pino-pretty", options: { colorize: true, sync: true } }
      });
      expect(gcpLogOptions).not.toHaveBeenCalled();
    });

    it("should initialize pino without pretty formatting for other formats", () => {
      config.STD_OUT_LOG_FORMAT = "json";
      new LoggerService();

      expect(pino).toHaveBeenCalledWith({ level: "info", mixin: undefined });
      expect(gcpLogOptions).toHaveBeenCalled();
    });

    it("should initialize pino with global mixin", () => {
      function globalMixin() {
        return {};
      }
      LoggerService.mixin = globalMixin;
      new LoggerService();

      expect(pino).toHaveBeenCalledWith({ level: "info", mixin: globalMixin });

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

      expect(pino).toHaveBeenCalledWith({ level: "info", mixin: localMixin });

      LoggerService.mixin = undefined;
    });

    it("should initialize pino with provided log level overriding global log level", () => {
      new LoggerService({ level: "debug" });

      expect(pino).toHaveBeenCalledWith({ level: "debug" });

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
      it("should return status, message, stack, and data for HttpError", () => {
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
          originalError: "stack trace"
        });
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
    });
  });
});

import createHttpError from "http-errors";
import pino from "pino";
import pinoFluentd from "pino-fluentd";
import pretty from "pino-pretty";

import { config } from "../../config";
import { Logger, LoggerService } from "./logger.service";

jest.mock("pino");
jest.mock("pino-fluentd");
jest.mock("pino-pretty");

describe("LoggerService", () => {
  let loggerService: LoggerService;
  let mockLogger: jest.Mocked<Logger>;
  const defaultLogFormat = config.STD_OUT_LOG_FORMAT;
  const defaultFluentdTag = config.FLUENTD_TAG;
  const defaultFluentdHost = config.FLUENTD_HOST;
  const defaultFluentdPort = config.FLUENTD_PORT;

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

  afterEach(() => {
    config.STD_OUT_LOG_FORMAT = defaultLogFormat;
    config.FLUENTD_TAG = defaultFluentdTag;
    config.FLUENTD_HOST = defaultFluentdHost;
    config.FLUENTD_PORT = defaultFluentdPort;
    jest.clearAllMocks();
  });

  describe("prototype.initPino", () => {
    it("should initialize pino with pretty formatting when STD_OUT_LOG_FORMAT is 'pretty'", () => {
      config.STD_OUT_LOG_FORMAT = "pretty";
      new LoggerService();
      expect(pretty).toHaveBeenCalledWith({ sync: true });
    });

    it("should initialize pino without pretty formatting for other formats", () => {
      config.STD_OUT_LOG_FORMAT = "json";
      new LoggerService();
      expect(pretty).not.toHaveBeenCalled();
      expect(pino).toHaveBeenCalled();
    });

    it("should initialize fluentd if configuration is enabled", () => {
      config.FLUENTD_HOST = "localhost";
      config.FLUENTD_PORT = 24224;
      config.FLUENTD_TAG = "app";

      new LoggerService();
      expect(pinoFluentd).toHaveBeenCalledWith({
        tag: config.FLUENTD_TAG,
        host: config.FLUENTD_HOST,
        port: config.FLUENTD_PORT,
        "trace-level": config.LOG_LEVEL
      });
    });

    it("should not initialize fluentd if configuration is missing", () => {
      config.FLUENTD_HOST = "";
      config.FLUENTD_PORT = 0;
      config.FLUENTD_TAG = "";

      new LoggerService();
      expect(pinoFluentd).not.toHaveBeenCalled();
    });
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

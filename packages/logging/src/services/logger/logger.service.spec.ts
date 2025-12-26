import createHttpError from "http-errors";
import { Transform, Writable } from "node:stream";
import type { LoggerOptions } from "pino";
import pino from "pino";

import { config } from "../../config";
import type { Logger } from "./logger.service";
import { LoggerService } from "./logger.service";

describe("LoggerService", () => {
  const defaultLogFormat = config.STD_OUT_LOG_FORMAT;
  const COMMON_EXPECTED_OPTIONS: LoggerOptions = {
    level: "info",
    mixin: undefined,
    timestamp: expect.any(Function),
    formatters: {
      level: expect.any(Function)
    },
    serializers: expect.any(Object),
    browser: {
      formatters: {
        level: expect.any(Function)
      }
    }
  };

  afterEach(() => {
    config.STD_OUT_LOG_FORMAT = defaultLogFormat;
  });

  describe("prototype.initPino", () => {
    it("should initialize pino with pretty formatting when STD_OUT_LOG_FORMAT is 'pretty'", () => {
      config.STD_OUT_LOG_FORMAT = "pretty";
      const pinoMock = jest.fn();
      new LoggerService({ createPino: pinoMock });

      expect(pinoMock).toHaveBeenCalledWith(COMMON_EXPECTED_OPTIONS, expect.any(Transform));
    });

    it("should initialize pino without pretty formatting for other formats", () => {
      config.STD_OUT_LOG_FORMAT = "json";
      const pinoMock = jest.fn();
      new LoggerService({ createPino: pinoMock });

      expect(pinoMock).toHaveBeenCalledWith(COMMON_EXPECTED_OPTIONS);
    });

    it("should initialize pino with global mixin", () => {
      function globalMixin() {
        return {};
      }
      LoggerService.mixin = globalMixin;
      const pinoMock = jest.fn();
      new LoggerService({ createPino: pinoMock });

      expect(pinoMock).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, mixin: globalMixin });
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
      const pinoMock = jest.fn();
      new LoggerService({ mixin: localMixin, createPino: pinoMock });

      expect(pinoMock).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, mixin: localMixin });

      LoggerService.mixin = undefined;
    });

    it("should initialize pino with provided log level overriding global log level", () => {
      const pinoMock = jest.fn();
      new LoggerService({ level: "debug", createPino: pinoMock });

      expect(pinoMock).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, level: "debug" });

      LoggerService.mixin = undefined;
    });

    it("should initialize pino with provided browser options", () => {
      const pinoMock = jest.fn();
      new LoggerService({ createPino: pinoMock, browser: { disabled: false } });

      expect(pinoMock).toHaveBeenCalledWith({ ...COMMON_EXPECTED_OPTIONS, browser: { ...COMMON_EXPECTED_OPTIONS.browser, disabled: false } });
    });
  });

  describe("methods", () => {
    (["info", "error", "warn", "debug", "fatal"] satisfies Array<keyof Logger>).forEach(method => {
      it(`should call pino.${method} when calling ${method} method`, () => {
        const pinoLogger = {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
          log: jest.fn(),
          fatal: jest.fn(),
          child: jest.fn().mockReturnThis()
        } as unknown as pino.Logger;
        const logger = new LoggerService({
          createPino: () => pinoLogger
        });
        logger[method]("Test message");
        expect(pinoLogger[method]).toHaveBeenCalledWith("Test message");
      });
    });
  });

  describe("logging output", () => {
    it("should return detailed information about HttpError", () => {
      const { logger, logs } = setup();
      const httpError = createHttpError(404, {
        status: 404,
        message: "Not found",
        stack: "stack trace",
        data: { key: "value" }
      });

      logger.info(httpError);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.objectContaining({
            status: 404,
            message: "Not found",
            stack: "stack trace",
            data: { key: "value" }
          })
        })
      );
    });

    it("should return detailed stack trace information about cause, errors, and original error for HttpError", () => {
      const { logger, logs } = setup();
      const httpError = createHttpError(404, {
        status: 404,
        message: "Not found",
        stack: "stack trace",
        data: { key: "value" },
        originalError: new Error("Original error"),
        cause: new Error("Cause error")
      });

      logger.info(httpError);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.objectContaining({
            status: 404,
            message: "Not found",
            stack: expect.stringContaining("stack trace\n\nCaused by:\n  Error: Cause error"),
            data: { key: "value" },
            originalError: expect.stringContaining("Error: Original error")
          })
        })
      );
    });

    it("should return cause for HttpError", () => {
      const { logger, logs } = setup();
      const httpError = createHttpError(404, {
        status: 404,
        message: "Not found",
        stack: "stack trace",
        data: { key: "value" },
        originalError: new Error("Original error")
      });

      logger.info(httpError);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.objectContaining({
            status: 404,
            message: "Not found",
            stack: "stack trace",
            data: { key: "value" },
            originalError: expect.stringContaining("Error: Original error")
          })
        })
      );
    });

    it("should include error cause in stack trace for Error instance", () => {
      const { logger, logs } = setup();
      const error = new Error("Test error");
      Object.assign(error, { cause: new Error("Cause error") });
      logger.info(error);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.stringContaining("Cause error"),
          msg: "Test error"
        })
      );
    });

    it("should return stack for general Error instance", () => {
      const { logger, logs } = setup();
      const error = new Error("Test error");
      logger.info(error);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: error.stack,
          msg: "Test error"
        })
      );
    });

    it("should return the original message if it is not an error", () => {
      const message = "Test message";
      const { logger, logs } = setup();
      logger.info(message);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          msg: message
        })
      );
    });

    it('should return stack trace for "error" and "err" property in object', () => {
      const { logger, logs } = setup();
      const error = new Error("Test error");
      Object.assign(error, { cause: new Error("Cause error") });

      logger.info({ error });
      expect(logs[0]).toEqual(
        expect.objectContaining({
          error: expect.stringContaining("Test error")
        })
      );
      expect(logs[0]).toEqual(
        expect.objectContaining({
          error: expect.stringContaining("Cause error")
        })
      );

      logger.info({ err: error });
      expect(logs[1]).toEqual(
        expect.objectContaining({
          err: expect.stringContaining("Test error")
        })
      );
      expect(logs[1]).toEqual(
        expect.objectContaining({
          err: expect.stringContaining("Cause error")
        })
      );
    });

    it("should return stack trace for AggregateError", () => {
      const { logger, logs } = setup();
      const error = new AggregateError([new Error("Test1 error"), new Error("Test2 error")]);
      logger.info(error);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.stringContaining("Test1 error")
        })
      );
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.stringContaining("Test2 error")
        })
      );
    });

    it("should sanitize invalid UTF message", () => {
      const { logger, logs } = setup();
      logger.info(
        "Error: Broadcasting transaction failed with code 2 (codespace: feegrant). Log: \rl�dqz\u0015M�J�\t���\\�ͺ� does not allow to pay fees for �|������z6�\u0010���M�ӧ�: basic allowance: fee limit exceeded (code: 2)"
      );
      expect(logs[0]).toEqual(
        expect.objectContaining({
          msg: "Error: Broadcasting transaction failed with code 2 (codespace: feegrant). Log: \\rl\\uFFFD+dqz\\u0015M\\uFFFD+J\\uFFFD+\\t\\uFFFD+\\\\uFFFD+ͺ\\uFFFD+ does not allow to pay fees for \\uFFFD+|\\uFFFD+z6\\uFFFD+\\u0010\\uFFFD+M\\uFFFD+ӧ\\uFFFD+: basic allowance: fee limit exceeded (code: 2)"
        })
      );
    });

    it("should sanitize invalid UTF in error", () => {
      const { logger, logs } = setup();
      logger.info(
        new Error(
          "Error: Broadcasting transaction failed with code 2 (codespace: feegrant). Log: \rl�dqz\u0015M�J�\t���\\�ͺ� does not allow to pay fees for �|������z6�\u0010���M�ӧ�: basic allowance: fee limit exceeded (code: 2)"
        )
      );
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.stringContaining(
            "Error: Broadcasting transaction failed with code 2 (codespace: feegrant). Log: \\rl\\uFFFD+dqz\\u0015M\\uFFFD+J\\uFFFD+\\t\\uFFFD+\\\\uFFFD+ͺ\\uFFFD+ does not allow to pay fees for \\uFFFD+|\\uFFFD+z6\\uFFFD+\\u0010\\uFFFD+M\\uFFFD+ӧ\\uFFFD+: basic allowance: fee limit exceeded (code: 2)"
          )
        })
      );
    });

    it("should collect sql from error", () => {
      const { logger, logs } = setup();
      const error = new Error("Test error");
      Object.assign(error, { sql: "SELECT * FROM users" });
      logger.info(error);
      expect(logs[0]).toEqual(
        expect.objectContaining({
          err: expect.objectContaining({
            sql: "SELECT * FROM users",
            stack: expect.stringContaining("Test error")
          })
        })
      );
    });

    function setup() {
      const logs: unknown[] = [];
      const logger = new LoggerService({
        createPino: options =>
          pino(
            options,
            new Writable({
              write(chunk, _enc, cb) {
                logs.push(JSON.parse(chunk.toString()));
                cb();
              }
            })
          )
      });

      return { logger, logs };
    }
  });
});

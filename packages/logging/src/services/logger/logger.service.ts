import { isHttpError } from "http-errors";
import type { DestinationStream } from "pino";
import pino from "pino";

import type { Config } from "../../config";
import { config as envConfig } from "../../config";
import { collectFullErrorStack, sanitizeString } from "../../utils/collect-full-error-stack/collect-full-error-stack";

export type LogMessage = string | (Record<string, unknown> & { error?: unknown; message?: string; event?: string });
type LogFn = {
  (message: LogMessage): void;
  (message: Error): void;
  (message: unknown): void;
};
export interface Logger {
  setContext(context: string): void;
  log: LogFn;
  info: LogFn;
  error: LogFn;
  warn: LogFn;
  debug: LogFn;
  fatal: LogFn;
}

interface Bindings extends pino.Bindings {
  context?: string;
}

export interface LoggerOptions extends pino.LoggerOptions {
  base?: Bindings | null;
  context?: string;
  createPino?(options: pino.LoggerOptions, stream?: DestinationStream | undefined): pino.Logger;
}

export const CUSTOM_LEVELS: Record<string, string> = {
  fatal: "critical"
};

export class LoggerService implements Logger {
  static config: Config = envConfig;

  static configure(config: Partial<Config>) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  static forContext(context: string) {
    const logger = new LoggerService();
    logger.setContext(context);

    return logger;
  }

  static mixin?: (mergeObject: object) => object;

  protected pino: pino.Logger;

  constructor(private readonly options?: LoggerOptions) {
    this.pino = this.initPino();

    if (options?.context) {
      this.setContext(options.context);
    }
  }

  private initPino(): pino.Logger {
    const { createPino = pino, context, ...additionalOptions } = this.options ?? {};
    const formatters: pino.LoggerOptions["formatters"] = {
      level(label) {
        return { level: CUSTOM_LEVELS[label] || label };
      }
    };
    const options: pino.LoggerOptions = {
      level: LoggerService.config.LOG_LEVEL,
      mixin: LoggerService.mixin,
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      formatters,
      serializers: {
        err: logError,
        error: logError,
        msg: sanitizeString,
        message: sanitizeString
      },
      ...additionalOptions,
      browser: {
        formatters,
        ...additionalOptions?.browser
      }
    };
    const destinationStream = this.getPrettyIfPresent();
    const logger = destinationStream?.ok ? createPino(options, destinationStream.value) : createPino(options);

    if (destinationStream?.ok === false) {
      logger.debug({ context: LoggerService.name, message: "Failed to load pino-pretty", error: destinationStream.error });
    }

    return logger;
  }

  private getPrettyIfPresent() {
    if (typeof window === "undefined" && LoggerService.config.STD_OUT_LOG_FORMAT === "pretty") {
      try {
        return {
          ok: true,
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          value: require("pino-pretty")({ colorize: true, sync: true })
        } as const;
      } catch (error) {
        return {
          ok: false,
          error
        } as const;
      }
    }
  }

  setContext(context: string) {
    this.bind({ context });
  }

  bind(bindings: pino.Bindings): this {
    this.pino = this.pino.child(bindings);

    return this;
  }

  log(message: LogMessage): void;
  log(message: Error): void;
  log(message: unknown): void;
  log(message: unknown): void {
    return this.info(message);
  }

  info(message: LogMessage): void;
  info(message: Error): void;
  info(message: unknown): void;
  info(message: unknown): void {
    return this.pino.info(message);
  }

  error(message: LogMessage): void;
  error(message: Error): void;
  error(message: unknown): void;
  error(message: unknown): void {
    if (message && message instanceof Error) {
      this.pino.error({ err: message });
    } else {
      this.pino.error(message);
    }
  }

  fatal(message: LogMessage): void;
  fatal(message: Error): void;
  fatal(message: unknown): void;
  fatal(message: unknown): void {
    this.pino.fatal(message);
  }

  warn(message: LogMessage): void;
  warn(message: Error): void;
  warn(message: unknown): void;
  warn(message: unknown): void {
    return this.pino.warn(message);
  }

  debug(message: LogMessage): void;
  debug(message: Error): void;
  debug(message: unknown): void;
  debug(message: unknown): void {
    return this.pino.debug(message);
  }
}

function logError(error: Error | undefined | null) {
  if (!error) return;

  if (isHttpError(error)) {
    return {
      // keep new line
      status: error.status,
      message: sanitizeString(error.message),
      stack: collectFullErrorStack(error),
      data: error.data,
      originalError: error.originalError ? collectFullErrorStack(error.originalError) : undefined
    };
  }

  if (Object.hasOwn(error, "sql")) {
    return {
      stack: collectFullErrorStack(error),
      sql: (error as Error & { sql: string }).sql
    };
  }

  return collectFullErrorStack(error);
}

declare let window: unknown;

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
    const options: pino.LoggerOptions = {
      level: LoggerService.config.LOG_LEVEL,
      mixin: LoggerService.mixin,
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      formatters: {
        level(label) {
          return { level: CUSTOM_LEVELS[label] || label };
        }
      },
      serializers: {
        err: collectFullErrorStack,
        error: collectFullErrorStack,
        originalError: collectFullErrorStack,
        msg: sanitizeString,
        message: sanitizeString
      },
      ...additionalOptions
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
    return this.pino.info(this.toLoggableInput(message));
  }

  error(message: LogMessage): void;
  error(message: Error): void;
  error(message: unknown): void;
  error(message: unknown): void {
    this.pino.error(this.toLoggableInput(message));
  }

  fatal(message: LogMessage): void;
  fatal(message: Error): void;
  fatal(message: unknown): void;
  fatal(message: unknown): void {
    this.pino.fatal(this.toLoggableInput(message));
  }

  warn(message: LogMessage): void;
  warn(message: Error): void;
  warn(message: unknown): void;
  warn(message: unknown): void {
    return this.pino.warn(this.toLoggableInput(message));
  }

  debug(message: LogMessage): void;
  debug(message: Error): void;
  debug(message: unknown): void;
  debug(message: unknown): void {
    return this.pino.debug(this.toLoggableInput(message));
  }

  protected toLoggableInput(message: unknown): any {
    if (!message) return;

    if (isHttpError(message)) {
      return {
        // keep new line
        status: message.status,
        message: sanitizeString(message.message),
        stack: collectFullErrorStack(message),
        data: message.data,
        originalError: message.originalError
      };
    }

    return message;
  }
}

declare let window: unknown;

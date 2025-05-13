import { isHttpError } from "http-errors";
import pino from "pino";
import type { PinoPretty } from "pino-pretty";

import type { Config } from "../../config";
import { config as envConfig } from "../../config";
import { collectFullErrorStack } from "../../utils/collect-full-error-stack/collect-full-error-stack";

export interface Logger extends Pick<pino.Logger, "info" | "error" | "warn" | "debug"> {
  setContext(context: string): void;
  log: pino.Logger["info"];
}

interface Bindings extends pino.Bindings {
  context?: string;
}

export interface LoggerOptions extends pino.LoggerOptions {
  base?: Bindings | null;
  context?: string;
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
    const options: LoggerOptions = {
      level: LoggerService.config.LOG_LEVEL,
      mixin: LoggerService.mixin,
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      formatters: {
        level(label) {
          return { level: CUSTOM_LEVELS[label] || label };
        }
      },
      ...this.options
    };

    const pretty = this.getPrettyIfPresent();

    if (pretty) {
      return pino(options, pretty);
    }

    return pino(options);
  }

  private getPrettyIfPresent(): PinoPretty.PrettyStream | undefined {
    if (typeof window === "undefined" && LoggerService.config.STD_OUT_LOG_FORMAT === "pretty") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require("pino-pretty")({ colorize: true, sync: true });
      } catch (e) {
        this.debug({ context: LoggerService.name, message: "Failed to load pino-pretty", error: e });
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

  log(message: any): void {
    return this.pino.info(message);
  }

  info(message: any): void {
    return this.pino.info(this.toLoggableInput(message));
  }

  error(message: any): void {
    this.pino.error(this.toLoggableInput(message));
  }

  warn(message: any): void {
    return this.pino.warn(this.toLoggableInput(message));
  }

  debug(message: any): void {
    return this.pino.debug(this.toLoggableInput(message));
  }

  protected toLoggableInput(message: unknown): any {
    if (!message) return;

    if (isHttpError(message)) {
      const loggableInput: Record<string, unknown> = {
        // keep new line
        status: message.status,
        message: message.message,
        stack: collectFullErrorStack(message),
        data: message.data
      };

      return "originalError" in message
        ? {
            ...loggableInput,
            originalError: collectFullErrorStack(message.originalError)
          }
        : loggableInput;
    }

    if (message instanceof Error) {
      return collectFullErrorStack(message);
    }

    if (typeof message === "object") {
      if (hasOwn(message, "error") && message.error && message.error instanceof Error) {
        return {
          ...message,
          error: collectFullErrorStack(message.error)
        };
      }
      if (hasOwn(message, "err") && message.err && message.err instanceof Error) {
        return {
          ...message,
          err: collectFullErrorStack(message.err)
        };
      }
      return message;
    }

    return message;
  }
}

function hasOwn<T extends object, U extends PropertyKey>(obj: T, key: U): obj is T & { [k in U]: unknown } {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

declare let window: any;

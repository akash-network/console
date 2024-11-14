import { isHttpError } from "http-errors";
import pino from "pino";
import { gcpLogOptions } from "pino-cloud-logging";

import { config } from "@src/core/config";

export type Logger = Pick<pino.Logger, "info" | "error" | "warn" | "debug">;

interface Bindings extends pino.Bindings {
  context?: string;
}

interface LoggerOptions extends pino.LoggerOptions {
  base?: Bindings | null;
}

export class LoggerService implements Logger {
  static forContext(context: string) {
    return new LoggerService().setContext(context);
  }

  static mixin: (mergeObject: object) => object;

  protected pino: pino.Logger;

  constructor(options?: LoggerOptions) {
    this.pino = this.initPino(options);
  }

  private initPino(inputOptions: LoggerOptions = {}): pino.Logger {
    let options: LoggerOptions = {
      level: config.LOG_LEVEL,
      mixin: LoggerService.mixin,
      ...inputOptions
    };

    if (typeof window === "undefined" && config.STD_OUT_LOG_FORMAT === "pretty") {
      options.transport = {
        target: "pino-pretty",
        options: { colorize: true, sync: true }
      };
    } else {
      options = gcpLogOptions(options as any) as LoggerOptions;
    }

    return pino(options);
  }

  setContext(context: string) {
    this.pino.setBindings({ context });

    return this;
  }

  bind(bindings: pino.Bindings) {
    this.pino.setBindings(bindings);

    return this;
  }

  info(message: any) {
    message = this.toLoggableInput(message);
    return this.pino.info(message);
  }

  error(message: any) {
    this.pino.error(this.toLoggableInput(message));
  }

  warn(message: any) {
    return this.pino.warn(this.toLoggableInput(message));
  }

  debug(message: any) {
    return this.pino.debug(this.toLoggableInput(message));
  }

  protected toLoggableInput(message: any) {
    if (isHttpError(message)) {
      const loggableInput = { status: message.status, message: message.message, stack: message.stack, data: message.data };
      return "originalError" in message
        ? {
            ...loggableInput,
            originalError: message.stack
          }
        : loggableInput;
    }

    if (message instanceof Error) {
      return message.stack;
    }

    return message;
  }
}

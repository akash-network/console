import { isHttpError } from "http-errors";
import pino from "pino";
import { gcpLogOptions } from "pino-cloud-logging";
import type { PinoPretty } from "pino-pretty";

import { Config, config as envConfig } from "../../config";

export type Logger = Pick<pino.Logger, "info" | "error" | "warn" | "debug">;

interface Bindings extends pino.Bindings {
  context?: string;
}

interface LoggerOptions extends pino.LoggerOptions {
  base?: Bindings | null;
}

export class LoggerService implements Logger {
  static config: Config = envConfig;

  static configure(config: Partial<Config>) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  static forContext(context: string) {
    return new LoggerService().setContext(context);
  }

  static mixin?: (mergeObject: object) => object;

  protected pino: pino.Logger;

  constructor(private readonly options?: LoggerOptions) {
    this.pino = this.initPino();
  }

  private initPino(): pino.Logger {
    const options: LoggerOptions = {
      level: LoggerService.config.LOG_LEVEL,
      mixin: LoggerService.mixin,
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      ...this.options
    };

    const pretty = this.getPrettyIfPresent();

    if (pretty) {
      return pino(options, pretty);
    }

    // pino-cloud-logging uses pino@8.x but we are using pino@9.x
    const gcpOptions = gcpLogOptions(options as any);
    // pino-cloud-logging uses pino@8.x but we are using pino@9.x
    return pino(gcpOptions as any);
  }

  private getPrettyIfPresent(): PinoPretty.PrettyStream | undefined {
    if (typeof window === "undefined" && LoggerService.config.STD_OUT_LOG_FORMAT === "pretty") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require("pino-pretty")({ colorize: true, sync: true });
      } catch (e) {
        this.debug({ context: LoggerService.name, message: "Failed to load pino-pretty", error: e });
        /* empty */
      }
    }
  }

  setContext(context: string) {
    this.bind({ context });

    return this;
  }

  bind(bindings: pino.Bindings) {
    this.pino = this.pino.child(bindings);

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

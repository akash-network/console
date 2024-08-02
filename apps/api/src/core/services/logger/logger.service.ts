import { isHttpError } from "http-errors";
import pino, { Bindings, LoggerOptions } from "pino";
import pretty from "pino-pretty";

import { config } from "@src/core/config";

export class LoggerService {
  protected pino: pino.Logger;

  readonly isPretty = config.LOG_FORMAT === "pretty";

  constructor(bindings?: Bindings) {
    const options: LoggerOptions = { level: config.LOG_LEVEL };

    this.pino = pino(options, config.NODE_ENV === "production" ? undefined : pretty({ sync: true }));

    if (bindings) {
      this.pino = this.pino.child(bindings);
    }
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
      return { status: message.status, message: message.message, stack: message.stack, data: message.data };
    }
    if (message instanceof Error) {
      return message.stack;
    }

    return message;
  }
}

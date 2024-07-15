import pino, { Bindings, LoggerOptions } from "pino";

import { config } from "@src/core/config";

export class LoggerService {
  protected pino: pino.Logger;

  readonly isPretty = config.LOG_FORMAT === "pretty";

  constructor(bindings?: Bindings) {
    const options: LoggerOptions = { level: config.LOG_LEVEL };

    if (this.isPretty) {
      options.transport = {
        target: "pino-pretty"
      };
    }

    this.pino = pino(options);

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
    if (message instanceof Error) {
      return message.stack;
    }

    return message;
  }
}

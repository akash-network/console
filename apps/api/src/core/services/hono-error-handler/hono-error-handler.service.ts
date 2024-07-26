import type { Context, Env } from "hono";
import { isHttpError } from "http-errors";
import { singleton } from "tsyringe";
import { ZodError } from "zod";

import { LoggerService } from "@src/core/services/logger/logger.service";

@singleton()
export class HonoErrorHandlerService {
  private readonly logger = new LoggerService({ context: "ErrorHandler" });

  constructor() {
    this.handle = this.handle.bind(this);
  }

  handle<E extends Env = any>(error: Error, c: Context<E>): Response | Promise<Response> {
    this.logger.error(error);

    if (isHttpError(error)) {
      const { name } = error.constructor;
      return c.json({ error: name, message: error.message, data: error.data }, { status: error.status });
    }

    if (error instanceof ZodError) {
      return c.json({ error: "BadRequestError", data: error.errors }, { status: 400 });
    }

    return c.json({ error: "InternalServerError" }, { status: 500 });
  }
}

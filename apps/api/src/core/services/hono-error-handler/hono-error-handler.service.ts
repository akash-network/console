import type { Context, Env } from "hono";
import { singleton } from "tsyringe";
import { ZodError } from "zod";

import { ForbiddenException, ManagedException } from "@src/core/exceptions";
import { NotFoundException } from "@src/core/exceptions/not-found.exception";
import { LoggerService } from "@src/core/services/logger/logger.service";

const EXCEPTION_STATUSES = {
  [ForbiddenException.name]: 403,
  [NotFoundException.name]: 404
};

@singleton()
export class HonoErrorHandlerService {
  private readonly logger = new LoggerService({ context: "ErrorHandler" });

  constructor() {
    this.handle = this.handle.bind(this);
  }

  handle<E extends Env = any>(error: Error, c: Context<E>): Response | Promise<Response> {
    this.logger.error(error);

    if (error instanceof ManagedException) {
      const { name } = error.constructor;
      const status = EXCEPTION_STATUSES[name];
      return c.json({ error: name, message: error.message, data: error.data }, { status });
    }

    if (error instanceof ZodError) {
      return c.json({ error: "BadRequestError", data: error.errors }, { status: 400 });
    }

    return c.json({ error: "InternalServerError" }, { status: 500 });
  }
}

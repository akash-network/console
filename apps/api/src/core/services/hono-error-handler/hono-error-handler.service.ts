import { LoggerService } from "@akashnetwork/logging";
import { ForbiddenError } from "@casl/ability";
import { isHttpError } from "http-errors";
import { DatabaseError } from "sequelize";
import { singleton } from "tsyringe";
import { ZodError } from "zod";

import type { AppContext } from "../../types/app-context";

@singleton()
export class HonoErrorHandlerService {
  private readonly logger = LoggerService.forContext("ErrorHandler");

  constructor() {
    this.handle = this.handle.bind(this);
  }

  async handle(error: unknown, c: AppContext): Promise<Response> {
    this.logger.error(this.toLoggableError(error));

    if (isHttpError(error)) {
      const { name } = error.constructor;
      return c.json({ error: name, message: error.message, data: error.data }, { status: error.status });
    }

    if (error instanceof ZodError) {
      return c.json({ error: "BadRequestError", data: error.errors }, { status: 400 });
    }

    if (error instanceof ForbiddenError) {
      return c.json({ error: "ForbiddenError", message: "Forbidden" }, { status: 403 });
    }

    return c.json({ error: "InternalServerError" }, { status: 500 });
  }

  private toLoggableError(error: unknown) {
    if (error instanceof DatabaseError) {
      return { error, sql: error.sql };
    }

    return error;
  }
}

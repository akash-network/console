import { LoggerService } from "@akashnetwork/logging";
import { ZodError } from "zod";

import type { AppContext } from "../../types/AppContext";

export class HonoErrorHandlerService {
  private readonly logger: LoggerService;

  constructor(logger = LoggerService.forContext("ErrorHandler")) {
    this.logger = logger;
    this.handle = this.handle.bind(this);
  }

  async handle(error: unknown, c: AppContext): Promise<Response> {
    this.logger.error({ error });

    if (error instanceof ZodError) {
      return c.json({ error: "BadRequestError", data: error.errors }, { status: 400 });
    }

    return c.json({ error: "InternalServerError" }, { status: 500 });
  }
}

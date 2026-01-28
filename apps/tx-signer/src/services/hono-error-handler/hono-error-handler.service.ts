import { createOtelLogger } from "@akashnetwork/logging/otel";
import { HTTPException } from "hono/http-exception";
import { isHttpError } from "http-errors";
import { singleton } from "tsyringe";
import { ZodError } from "zod";

import type { AppContext } from "@src/types/app-context";

@singleton()
export class HonoErrorHandlerService {
  private readonly logger = createOtelLogger({ context: "ErrorHandler" });

  constructor() {
    this.handle = this.handle.bind(this);
  }

  async handle(error: unknown, c: AppContext): Promise<Response> {
    this.logger.error(error);

    if (error instanceof HTTPException) {
      return c.json(
        {
          error: error.name || "HTTPException",
          message: error.message,
          code: this.getErrorCode(error),
          type: this.getErrorType(error)
        },
        { status: error.status }
      );
    }

    if (isHttpError(error)) {
      const { name } = error.constructor;
      return c.json(
        {
          error: name,
          message: error.message,
          code: this.getErrorCode(error),
          type: this.getErrorType(error),
          data: error.data
        },
        { status: error.status }
      );
    }

    if (error instanceof ZodError) {
      return c.json(
        {
          error: "BadRequestError",
          message: "Validation error",
          code: "validation_error",
          type: "validation_error",
          data: error.errors
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return c.json(
      {
        error: "InternalServerError",
        message,
        code: "internal_server_error",
        type: "server_error"
      },
      { status: 500 }
    );
  }

  private getErrorCode(error: { status?: number }): string {
    switch (error.status) {
      case 400:
        return "bad_request";
      case 401:
        return "unauthorized";
      case 403:
        return "forbidden";
      case 404:
        return "not_found";
      case 409:
        return "conflict";
      case 429:
        return "rate_limited";
      case 502:
        return "service_unavailable";
      case 503:
        return "service_unavailable";
      default:
        return "unknown_error";
    }
  }

  private getErrorType(error: { status?: number }): string {
    if (error.status && error.status >= 500) {
      return "server_error";
    }
    if (error.status && error.status >= 400) {
      return "client_error";
    }
    return "unknown_error";
  }
}

import { LoggerService } from "@akashnetwork/logging";
import { ForbiddenError } from "@casl/ability";
import { HTTPException } from "hono/http-exception";
import { isHttpError } from "http-errors";
import { ConnectionAcquireTimeoutError, ConnectionError, DatabaseError } from "sequelize";
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

    // Handle Hono's HTTPException (e.g., malformed JSON from validators)
    if (error instanceof HTTPException) {
      const errorCode = this.getErrorCode({ status: error.status });
      const errorType = this.getErrorType({ status: error.status });

      return c.json(
        {
          error: error.name || "HTTPException",
          message: error.message,
          code: errorCode,
          type: errorType
        },
        { status: error.status }
      );
    }

    if (isHttpError(error)) {
      const { name } = error.constructor;
      const errorCode = error.data?.errorCode || this.getErrorCode(error);
      const errorType = error.data?.errorType || this.getErrorType(error);

      return c.json(
        {
          error: name,
          message: error.message,
          code: errorCode,
          type: errorType,
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

    if (error instanceof ForbiddenError) {
      return c.json(
        {
          error: "ForbiddenError",
          message: "Forbidden",
          code: "forbidden",
          type: "authorization_error"
        },
        { status: 403 }
      );
    }

    if (error instanceof ConnectionAcquireTimeoutError || error instanceof ConnectionError) {
      return c.json(
        {
          error: "BadGatewayError",
          message: "Database connection timeout",
          code: "database_timeout",
          type: "service_unavailable"
        },
        { status: 502 }
      );
    }

    return c.json(
      {
        error: "InternalServerError",
        message: "Internal server error",
        code: "internal_server_error",
        type: "server_error"
      },
      { status: 500 }
    );
  }

  private getErrorCode(error: { status?: number; message?: string }): string {
    // HTTP status-based codes (primary method)
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
    // Determine error type based on HTTP status
    if (error.status && error.status >= 500) {
      return "server_error";
    } else if (error.status && error.status >= 400) {
      return "client_error";
    }

    return "unknown_error";
  }

  private toLoggableError(error: unknown) {
    if (error instanceof DatabaseError) {
      return { error, sql: error.sql };
    }

    return error;
  }
}

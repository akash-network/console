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
      const errorCode = this.getErrorCode(error);
      const errorType = this.getErrorType(error);

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
          data: error.data ? this.serializeSafely(error.data) : undefined
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
          data: this.serializeSafely(error.errors)
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
      return { error: this.serializeSafely(error), sql: error.sql };
    }

    return this.serializeSafely(error);
  }

  /**
   * Safely serializes an error object to ensure it can be logged without throwing serialization errors.
   * Handles BigInt, typed arrays, circular references, and other non-serializable values.
   */
  private serializeSafely(value: unknown, seen = new WeakSet()): unknown {
    // Handle primitives and null
    if (value === null || value === undefined) {
      return value;
    }

    const type = typeof value;

    if (type === "string" || type === "number" || type === "boolean") {
      return value;
    }

    // Handle BigInt by converting to string
    if (type === "bigint") {
      return value.toString();
    }

    // Handle functions - convert to string representation
    if (type === "function") {
      return "[Function]";
    }

    // Handle symbols
    if (type === "symbol") {
      return value.toString();
    }

    // Handle objects (including arrays, typed arrays, etc.)
    if (type === "object") {
      // Check for circular references
      if (seen.has(value as object)) {
        return "[Circular]";
      }
      seen.add(value as object);

      // Handle Date
      if (value instanceof Date) {
        return value.toISOString();
      }

      // Handle Error objects - preserve important properties
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...(Object.keys(value).length > 0 && this.serializeObjectProperties(value, seen))
        };
      }

      // Handle typed arrays (Uint8Array, etc.) - truncate if too large
      if (ArrayBuffer.isView(value)) {
        const typedArray = value as
          | Uint8Array
          | Int8Array
          | Uint16Array
          | Int16Array
          | Uint32Array
          | Int32Array
          | Float32Array
          | Float64Array;
        const arr = Array.from(typedArray);

        if (arr.length > 100) {
          return {
            type: value.constructor.name,
            length: arr.length,
            preview: arr.slice(0, 10),
            note: `${arr.length - 10} items not shown`
          };
        }

        return arr;
      }

      // Handle regular arrays
      if (Array.isArray(value)) {
        return value.map(item => this.serializeSafely(item, seen));
      }

      // Handle plain objects and other objects
      return this.serializeObjectProperties(value, seen);
    }

    // Fallback for any other type
    return String(value);
  }

  private serializeObjectProperties(obj: object, seen: WeakSet<object>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    try {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            result[key] = this.serializeSafely((obj as Record<string, unknown>)[key], seen);
          } catch {
            result[key] = "[Unserializable]";
          }
        }
      }
    } catch {
      return { error: "[Failed to serialize object properties]" };
    }

    return result;
  }
}

import { ForbiddenError } from "@casl/ability";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { ZodSerializationException, ZodValidationException } from "nestjs-zod";

import { LoggerService } from "@src/common/services/logger/logger.service";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isSerializationException = exception instanceof ZodSerializationException;

    if (exception instanceof ZodValidationException) {
      const statusCode = exception.getStatus();
      response.status(statusCode).json({
        statusCode,
        message: exception.message,
        errors: exception.getZodError()
      });
    } else if (exception instanceof HttpException && !isSerializationException) {
      const statusCode = exception.getStatus();
      response.status(statusCode).json({
        statusCode,
        message: exception.message,
        errors: exception.cause
      });
    } else if (exception instanceof ForbiddenError) {
      response.status(403).json({
        statusCode: 403,
        message: exception.message,
        errors: exception.cause
      });
    } else {
      if (isSerializationException) {
        this.logger.error({ event: "HTTP_RESPONSE_VALIDATION_FAILED", error: exception });
      } else {
        this.logger.error({ event: "HTTP_REQUEST_FAILED", error: exception });
      }

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error"
      });
    }
  }
}

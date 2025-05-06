import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  Optional,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable, of } from 'rxjs';
import { Err, Ok, Result } from 'ts-results';
import { ZodTypeAny } from 'zod';

import { LoggerService } from '@src/common/services/logger/logger.service';

const VALIDATION_META_KEY = Symbol('HttpValidation');

export interface ValidateHttpOptions {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  response?: ZodTypeAny;
}

/**
 * Decorator to apply Zod-based HTTP validation.
 */
export function ValidateHttp(options: ValidateHttpOptions) {
  return applyDecorators(
    UseInterceptors(HttpValidateInterceptor),
    (target: any, key?: string | symbol) => {
      Reflect.defineMetadata(
        VALIDATION_META_KEY,
        options,
        key ? target[key] : target,
      );
    },
  );
}

/**
 * Interceptor that validates request and response using Zod schemas.
 */
@Injectable()
export class HttpValidateInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    private readonly loggerService: LoggerService = new LoggerService(),
  ) {
    loggerService.setContext(HttpValidateInterceptor.name);
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<
    Result<unknown, BadRequestException | InternalServerErrorException>
  > {
    const handler = context.getHandler();
    const options = this.reflector.get<ValidateHttpOptions>(
      VALIDATION_META_KEY,
      handler,
    );

    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest();

    if (options.body) {
      const result = options.body.safeParse(request.body);
      if (!result.success) {
        return of(
          Err(
            new BadRequestException('Invalid body', {
              description: result.error.message,
              cause: result.error.errors,
            }),
          ),
        );
      }
      request.body = result.data;
    }

    if (options.query) {
      const result = options.query.safeParse(request.query);
      if (!result.success) {
        return of(
          Err(
            new BadRequestException('Invalid query', {
              description: 'Invalid query',
              cause: result.error.errors,
            }),
          ),
        );
      }
      Object.assign(request.query, result.data);
    }

    if (options.params) {
      const result = options.params.safeParse(request.params);
      if (!result.success) {
        return of(
          Err(
            new BadRequestException('Invalid params', {
              description: 'Invalid params',
              cause: result.error.errors,
            }),
          ),
        );
      }
      Object.assign(request.params, result.data);
    }

    if (options.response) {
      return next.handle().pipe(
        map((data) => {
          if (options.response) {
            const unwrapped = data instanceof Ok ? data.val : data;
            const result = options.response.safeParse(unwrapped);
            if (!result.success) {
              this.loggerService.error({
                event: 'HTTP_RESPONSE_VALIDATION_FAILED',
                error: result.error,
              });
              return Err(new InternalServerErrorException());
            }
            return result.data;
          }
          return data;
        }),
      );
    }

    return next.handle();
  }
}

import { applyDecorators, UsePipes } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import type { ZodDto } from "nestjs-zod";
import { ZodValidationException } from "nestjs-zod";
import { createZodDto } from "nestjs-zod";
import { ZodSerializerDto, ZodValidationPipe } from "nestjs-zod";
import type { ZodTypeDef } from "zod";
import { z } from "zod";

const notFoundErrorResponseSchema = z.object({
  statusCode: z.literal(404),
  message: z.string()
});

export class NotFoundErrorResponse extends createZodDto(notFoundErrorResponseSchema) {}

const internalServerErrorResponseSchema = z.object({
  statusCode: z.literal(500),
  message: z.string()
});

export class InternalServerErrorResponse extends createZodDto(internalServerErrorResponseSchema) {}

const validationErrorResponseSchema = z.object({
  statusCode: z.literal(400),
  message: z.string(),
  errors: z.object({
    issues: z.array(z.object({}))
  })
});

export class ValidationErrorResponse extends createZodDto(validationErrorResponseSchema) {}
ZodValidationException;
type ResponseDefinitionOptions = Record<
  number,
  {
    description?: string;
    schema: ZodDto<any, ZodTypeDef, any>;
  }
>;

export function ValidateHttp(options: ResponseDefinitionOptions) {
  const successSchema = (options[200] || options[201])?.schema;

  const decorators = [UsePipes(ZodValidationPipe)];

  for (const [statusCode, def] of Object.entries(options)) {
    decorators.push(
      ApiResponse({
        status: Number(statusCode),
        type: def.schema,
        description: def.description
      })
    );
  }

  if (!options[500]) {
    decorators.push(
      ApiResponse({
        status: 500,
        type: InternalServerErrorResponse,
        description: "Internal server error, should probably be reported"
      })
    );
  }

  if (!options[400]) {
    decorators.push(
      ApiResponse({
        status: 400,
        type: ValidationErrorResponse,
        description: "Validation error responded when some request parameters are invalid"
      })
    );
  }

  if (successSchema) {
    decorators.push(ZodSerializerDto(successSchema));
  }

  return applyDecorators(...decorators);
}

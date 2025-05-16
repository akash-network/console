import { applyDecorators, UsePipes } from "@nestjs/common";
import { ApiCreatedResponse } from "@nestjs/swagger";
import type { ZodDto } from "nestjs-zod";
import { ZodSerializerDto, ZodValidationPipe } from "nestjs-zod";
import type { ZodTypeDef } from "zod";

export function ValidateHttp(options: { response?: ZodDto<any, ZodTypeDef, any> }) {
  const decorators = [
    UsePipes(ZodValidationPipe),
    ApiCreatedResponse({
      type: options.response
    })
  ];

  if (options?.response) {
    decorators.push(ZodSerializerDto(options.response));
  }

  return applyDecorators(...decorators);
}

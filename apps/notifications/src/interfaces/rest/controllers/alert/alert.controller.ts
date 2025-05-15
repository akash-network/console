import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import {
  alertCreateInputSchema,
  AlertOutputResponse,
  alertOutputResponseSchema,
  alertPatchInputSchema
} from "@src/interfaces/rest/http-schemas/alert.http-schema";
import { ValidateHttp } from "@src/interfaces/rest/interceptors/http-validate/http-validate.interceptor";
import { AlertOutput, AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";

@Controller({
  version: "1",
  path: "alerts"
})
export class AlertController {
  constructor(private readonly alertRepository: AlertRepository) {}

  @Post()
  @ValidateHttp({
    body: z.object({ data: alertCreateInputSchema }),
    response: alertOutputResponseSchema
  })
  async createAlert(@Body() { data }: { data: z.infer<typeof alertCreateInputSchema> }): Promise<Result<AlertOutputResponse, unknown>> {
    return Ok({
      data: await this.alertRepository.create(data)
    });
  }

  @Get(":id")
  @ValidateHttp({
    response: alertOutputResponseSchema
  })
  async getAlert(@Param("id") id: string): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.alertRepository.findOneById(id);
    return this.toResponse(alert);
  }

  @Patch(":id")
  @ValidateHttp({
    body: z.object({ data: alertPatchInputSchema }),
    response: alertOutputResponseSchema
  })
  async patchAlert(
    @Param("id") id: string,
    @Body() { data }: { data: z.infer<typeof alertPatchInputSchema> }
  ): Promise<Result<AlertOutputResponse, NotFoundException | BadRequestException>> {
    const alert = await this.alertRepository.updateById(id, data);
    return this.toResponse(alert);
  }

  @Delete(":id")
  @ValidateHttp({
    response: alertOutputResponseSchema
  })
  async deleteAlert(@Param("id") id: string): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.alertRepository.deleteOneById(id);
    return this.toResponse(alert);
  }

  private toResponse(alert: AlertOutput | undefined): Result<AlertOutputResponse, NotFoundException> {
    return alert ? Ok({ data: alert }) : Err(new NotFoundException("Alert not found"));
  }
}

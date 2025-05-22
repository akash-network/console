import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";

import { ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { AlertCreateInput, AlertOutputResponse, AlertPatchInput } from "@src/interfaces/rest/http-schemas/alert.http-schema";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { AlertOutput, AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";

@Controller({
  version: "1",
  path: "alerts"
})
export class AlertController {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly authService: AuthService
  ) {}

  @Post()
  @ValidateHttp({
    201: { schema: AlertOutputResponse, description: "Returns the created alert" }
  })
  async createAlert(@Body() { data }: AlertCreateInput): Promise<Result<AlertOutputResponse, unknown>> {
    return Ok({
      data: await this.alertRepository.accessibleBy(this.authService.ability, "create").create(data)
    });
  }

  @Get(":id")
  @ValidateHttp({
    200: { schema: AlertOutputResponse, description: "Returns the requested alert by id" }
  })
  async getAlert(@Param("id") id: string): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.alertRepository.accessibleBy(this.authService.ability, "read").findOneById(id);
    return this.toResponse(alert);
  }

  @Patch(":id")
  @ValidateHttp({
    200: { schema: AlertOutputResponse, description: "Returns the updated alert" }
  })
  async patchAlert(@Param("id") id: string, @Body() { data }: AlertPatchInput): Promise<Result<AlertOutputResponse, NotFoundException | BadRequestException>> {
    const alert = await this.alertRepository.accessibleBy(this.authService.ability, "update").updateById(id, data);
    return this.toResponse(alert);
  }

  @Delete(":id")
  @ValidateHttp({
    200: { schema: AlertOutputResponse, description: "Returns the deleted alert" }
  })
  async deleteAlert(@Param("id") id: string): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.alertRepository.accessibleBy(this.authService.ability, "delete").deleteOneById(id);
    return this.toResponse(alert);
  }

  private toResponse(alert: AlertOutput | undefined): Result<AlertOutputResponse, NotFoundException> {
    return alert ? Ok({ data: alert }) : Err(new NotFoundException("Alert not found"));
  }
}

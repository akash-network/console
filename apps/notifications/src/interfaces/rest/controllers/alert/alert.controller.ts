import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiQuery } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { AlertCreateInput, AlertListOutputResponse, AlertOutputResponse, AlertPatchInput } from "@src/interfaces/rest/http-schemas/alert.http-schema";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { toPaginatedQuery } from "@src/lib/http-schema/http-schema";
import { AlertOutput, AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { balanceConditionsSchema } from "@src/modules/alert/repositories/alert/alert-json-fields.schema";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

class AlertListQuery extends createZodDto(
  toPaginatedQuery({
    dseq: z.string().optional(),
    type: z.string().optional()
  })
) {}

@Controller({
  version: "1",
  path: "alerts"
})
export class AlertController {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly notificationChannelRepository: NotificationChannelRepository,
    private readonly authService: AuthService
  ) {}

  @Post()
  @ValidateHttp({
    201: { schema: AlertOutputResponse, description: "Returns the created alert" }
  })
  async createAlert(@Body() { data }: AlertCreateInput): Promise<Result<AlertOutputResponse, unknown>> {
    await this.assertOwnsNotificationChannel(data.notificationChannelId);

    return Ok({
      data: await this.alertRepository.accessibleBy(this.authService.ability, "create").create({
        ...data,
        userId: this.authService.userId
      })
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

  @Get()
  @ValidateHttp({
    200: { schema: AlertListOutputResponse, description: "Returns the list of alerts" }
  })
  @ApiQuery({
    name: "dseq",
    required: false,
    type: String,
    description: "Linked deployment's dseq"
  })
  @ApiQuery({
    name: "type",
    required: false,
    type: String,
    description: "Chain message type, used in conjunction with dseq to filter alerts liked to a specific deployment"
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number"
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of items per page"
  })
  async listAlerts(@Query() { page, limit, ...query }: AlertListQuery): Promise<Result<AlertListOutputResponse, NotFoundException>> {
    return Ok(await this.alertRepository.accessibleBy(this.authService.ability, "read").paginate({ page, limit, query }));
  }

  @Patch(":id")
  @ValidateHttp({
    200: { schema: AlertOutputResponse, description: "Returns the updated alert" }
  })
  async updateAlert(@Param("id") id: string, @Body() { data }: AlertPatchInput): Promise<Result<AlertOutputResponse, NotFoundException | BadRequestException>> {
    if (data.notificationChannelId) {
      await this.assertOwnsNotificationChannel(data.notificationChannelId);
    }

    if (data.conditions) {
      await this.assertConditionsMatchAlertType(id, data.conditions);
    }

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

  private async assertConditionsMatchAlertType(id: string, conditions: NonNullable<AlertPatchInput["data"]["conditions"]>): Promise<void> {
    const alert = await this.alertRepository.accessibleBy(this.authService.ability, "read").findOneById(id);
    const requiresBalanceConditions = alert?.type === "WALLET_BALANCE" || alert?.type === "DEPLOYMENT_BALANCE";

    if (requiresBalanceConditions && !balanceConditionsSchema.safeParse(conditions).success) {
      throw new BadRequestException("Conditions must match the balance alert shape");
    }
  }

  private async assertOwnsNotificationChannel(notificationChannelId: string): Promise<void> {
    const channel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "read").findById(notificationChannelId);

    if (!channel) {
      throw new NotFoundException("Notification channel not found");
    }
  }

  private toResponse(alert: AlertOutput | undefined): Result<AlertOutputResponse, NotFoundException> {
    return alert ? Ok({ data: alert }) : Err(new NotFoundException("Alert not found"));
  }
}

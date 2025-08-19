import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiNoContentResponse, ApiQuery } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { NotFoundErrorResponse, ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { toPaginatedQuery, toPaginatedResponse } from "@src/lib/http-schema/http-schema";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import {
  notificationChannelConfigSchema,
  NotificationChannelOutput as RepoNotificationChannelOutput,
  NotificationChannelRepository
} from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

export const notificationChannelCreateInputSchema = z.object({
  name: z.string(),
  type: z.literal("email"),
  config: notificationChannelConfigSchema,
  isDefault: z.boolean().optional()
});

export const notificationChannelCreateDefaultInputSchema = notificationChannelCreateInputSchema.omit({ isDefault: true });

export const notificationChannelOutputSchema = notificationChannelCreateInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const notificationChannelOutputResponseSchema = z.object({
  data: notificationChannelOutputSchema
});
export type NotificationChannelOutputResponse = z.infer<typeof notificationChannelOutputResponseSchema>;

export const notificationChannelPatchInputSchema = z.object({
  name: z.string().optional(),
  type: z.literal("email").optional(),
  config: notificationChannelConfigSchema.optional()
});

class NotificationChannelCreateInput extends createZodDto(z.object({ data: notificationChannelCreateInputSchema })) {}
class NotificationChannelPatchInput extends createZodDto(z.object({ data: notificationChannelPatchInputSchema })) {}
class NotificationChannelOutput extends createZodDto(notificationChannelOutputResponseSchema) {}
class NotificationChannelListQuery extends createZodDto(toPaginatedQuery()) {}
class NotificationChannelListOutput extends createZodDto(toPaginatedResponse(notificationChannelOutputSchema)) {}
class NotificationChannelCreateDefaultInput extends createZodDto(z.object({ data: notificationChannelCreateDefaultInputSchema })) {}

@Controller({
  version: "1",
  path: "notification-channels"
})
export class NotificationChannelController {
  constructor(
    private readonly notificationChannelRepository: NotificationChannelRepository,
    private readonly alertRepository: AlertRepository,
    private readonly authService: AuthService
  ) {}

  @Post()
  @ValidateHttp({
    201: {
      schema: NotificationChannelOutput,
      description: "Returns the created notification channel"
    }
  })
  async createNotificationChannel(@Body() { data }: NotificationChannelCreateInput): Promise<Result<NotificationChannelOutputResponse, unknown>> {
    return Ok({
      data: await this.notificationChannelRepository.accessibleBy(this.authService.ability, "create").create({
        ...data,
        isDefault: data.isDefault ?? false,
        userId: this.authService.userId
      })
    });
  }

  @Post("default")
  @HttpCode(204)
  @ApiNoContentResponse({ description: "Creates the default notification channel only if it doesn't exist." })
  async createDefaultChannel(@Body() { data }: NotificationChannelCreateDefaultInput): Promise<Result<void, unknown>> {
    await this.notificationChannelRepository.accessibleBy(this.authService.ability, "create").createDefaultChannel({
      ...data,
      userId: this.authService.userId
    });

    return Ok(undefined);
  }

  @Get(":id")
  @ValidateHttp({
    200: {
      schema: NotificationChannelOutput,
      description: "Returns the requested notification channel by id"
    },
    404: {
      schema: NotFoundErrorResponse,
      description: "Returns 404 if the notification channel is not found"
    }
  })
  async getNotificationChannel(@Param("id") id: string): Promise<Result<NotificationChannelOutputResponse, NotFoundException>> {
    const notificationChannel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "read").findById(id);
    return this.toResponse(notificationChannel);
  }

  @Get()
  @ValidateHttp({
    200: {
      schema: NotificationChannelListOutput,
      description: "Returns a paginated list of notification channels"
    }
  })
  // TODO: upgrade nestjs-zod to v5 and remove these defs
  //  Issue: https://github.com/BenLorantfy/nestjs-zod/issues/120
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
  async getNotificationChannels(@Query() query: NotificationChannelListQuery): Promise<Result<NotificationChannelListOutput, unknown>> {
    return Ok(await this.notificationChannelRepository.accessibleBy(this.authService.ability, "read").paginate(query));
  }

  @Patch(":id")
  @ValidateHttp({
    200: { schema: NotificationChannelOutput, description: "Returns the updated notification channel" },
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the notification channel is not found" }
  })
  async patchNotificationChannel(
    @Param("id") id: string,
    @Body() { data }: NotificationChannelPatchInput
  ): Promise<Result<NotificationChannelOutputResponse, NotFoundException>> {
    const notificationChannel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "update").updateById(id, data);
    return this.toResponse(notificationChannel);
  }

  @Delete(":id")
  @ValidateHttp({
    200: { schema: NotificationChannelOutput, description: "Returns the deleted notification channel" },
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the notification channel is not found" }
  })
  async deleteNotificationChannel(@Param("id") id: string): Promise<Result<NotificationChannelOutputResponse, NotFoundException | BadRequestException>> {
    const count = await this.alertRepository.countActiveByNotificationChannelId(id);
    if (count > 0) {
      return Err(new BadRequestException("Cannot delete notification channel with alerts"));
    }

    const notificationChannel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "delete").deleteSafelyById(id);
    return this.toResponse(notificationChannel);
  }

  private toResponse(notificationChannel: RepoNotificationChannelOutput | undefined): Result<NotificationChannelOutputResponse, NotFoundException> {
    return notificationChannel ? Ok({ data: notificationChannel }) : Err(new NotFoundException("Notification channel not found"));
  }
}

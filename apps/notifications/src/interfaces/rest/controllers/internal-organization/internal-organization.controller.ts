import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UsePipes } from "@nestjs/common";
import { ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { createZodDto, ZodValidationPipe } from "nestjs-zod";
import { z } from "zod";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Unprotected } from "@src/interfaces/rest/interceptors/auth/auth.interceptor";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

class DepartedMemberInput extends createZodDto(
  z.object({
    data: z.object({
      addressSha256: z
        .string()
        .regex(/^[0-9a-f]{64}$/)
        .describe("SHA-256 hex digest of the departed member's lower-cased email address"),
      fallbackAddresses: z
        .array(z.string().email())
        .describe("Where a channel goes once the departed member's address was its only one; without any, such a channel is deleted")
    })
  })
) {}

@ApiTags("Internal/Organization")
@Controller({ path: "internal/v1/organizations" })
@Unprotected()
export class InternalOrganizationController {
  constructor(
    private readonly notificationChannelRepository: NotificationChannelRepository,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(InternalOrganizationController.name);
  }

  @Post(":organizationId/departed-members")
  @HttpCode(204)
  @UsePipes(ZodValidationPipe)
  @ApiNoContentResponse({ description: "Stops the organization's notification channels from emailing a member who left it" })
  async releaseDepartedMember(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Body() { data }: DepartedMemberInput): Promise<void> {
    const channelsReleased = await this.notificationChannelRepository.releaseAddressInOrganization({ organizationId, ...data });

    this.loggerService.log({ event: "DEPARTED_MEMBER_RELEASED_FROM_CHANNELS", organizationId, channelsReleased });
  }
}

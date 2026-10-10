import { BadRequestException, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Unprotected } from "@src/interfaces/rest/interceptors/auth/auth.interceptor";
import { AccountPurgeService } from "@src/interfaces/rest/services/account-purge/account-purge.service";
import { IDENTITY_HEADERS } from "@src/interfaces/rest/services/auth/request-identity";

const personalOrganizationIdSchema = z.string().uuid().optional();

@ApiTags("Internal/Account")
@Controller({ path: "internal/v1/users" })
@Unprotected()
export class InternalAccountController {
  constructor(
    private readonly accountPurgeService: AccountPurgeService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(InternalAccountController.name);
  }

  @Post(":userId/purge")
  @HttpCode(204)
  async purge(@Param("userId", new ParseUUIDPipe()) userId: string, @Headers(IDENTITY_HEADERS.organizationId) organizationHeader?: string): Promise<void> {
    const personalOrganizationId = personalOrganizationIdSchema.safeParse(organizationHeader);

    if (!personalOrganizationId.success) {
      throw new BadRequestException("The personal organization must be a uuid");
    }

    try {
      const { alertsDeleted, channelsDeleted } = await this.accountPurgeService.purge(userId, personalOrganizationId.data ?? null);
      this.loggerService.log({
        event: "ACCOUNT_PURGE_COMPLETED",
        userId,
        alertsDeleted,
        channelsDeleted
      });
    } catch (error) {
      this.loggerService.error({
        event: "ACCOUNT_PURGE_FAILED",
        userId,
        error
      });
      throw error;
    }
  }
}

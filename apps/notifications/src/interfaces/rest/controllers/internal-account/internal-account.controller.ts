import { Controller, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Unprotected } from "@src/interfaces/rest/interceptors/auth/auth.interceptor";
import { AccountPurgeService } from "@src/interfaces/rest/services/account-purge/account-purge.service";

@ApiTags("Internal/Account")
@Controller({ path: "internal/users" })
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
  async purge(@Param("userId", new ParseUUIDPipe()) userId: string): Promise<void> {
    try {
      const { alertsDeleted, channelsDeleted } = await this.accountPurgeService.purge(userId);
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

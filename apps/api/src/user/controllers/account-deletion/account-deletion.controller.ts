import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { AuthMethod } from "@src/core/types/app-context";
import type { ConfirmAccountDeletionRequest, InitiateAccountDeletionRequest } from "@src/user/http-schemas/account-deletion.schema";
import { AccountDeletionService } from "@src/user/services/account-deletion/account-deletion.service";

export interface AccountDeletionRequestOrigin {
  authMethod?: AuthMethod;
  ip?: string;
  userAgent?: string;
}

@singleton()
export class AccountDeletionController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountDeletionService: AccountDeletionService
  ) {}

  async initiate({ data }: InitiateAccountDeletionRequest, origin: AccountDeletionRequestOrigin): Promise<void> {
    this.accountDeletionService.assertEnabledFor();
    const user = this.authService.safeCurrentUser;
    assert(user, 401);
    assert(origin.authMethod === "bearer", 403, "Account deletion can only be started from a signed-in Console session.", { errorCode: "session_required" });

    await this.accountDeletionService.initiate(user, { forfeitAcknowledged: data.forfeitAcknowledged, ip: origin.ip, userAgent: origin.userAgent });
  }

  async confirm({ data }: ConfirmAccountDeletionRequest, origin: AccountDeletionRequestOrigin): Promise<void> {
    await this.accountDeletionService.confirm({ token: data.token, ip: origin.ip });
  }
}

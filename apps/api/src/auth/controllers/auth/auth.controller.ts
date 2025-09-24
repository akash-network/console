import { singleton } from "tsyringe";

import type { SendVerificationEmailRequestInput } from "@src/auth";
import { VerifyEmailRequest } from "@src/auth/http-schemas/verify-email.schema";
import { AuthService, Protected } from "@src/auth/services/auth.service";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserService } from "@src/user/services/user/user.service";

@singleton()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auth0: Auth0Service,
    private readonly userService: UserService
  ) {}

  @Protected()
  async sendVerificationEmail({ data: { userId } }: SendVerificationEmailRequestInput) {
    const { currentUser } = this.authService;
    this.authService.throwUnlessCan("create", "VerificationEmail", { id: userId });

    if (currentUser?.userId) {
      await this.auth0.sendVerificationEmail(currentUser.userId);
    }
  }

  async syncEmailVerified({ data: { email } }: VerifyEmailRequest) {
    const { emailVerified } = await this.userService.syncEmailVerified({ email });

    return {
      data: {
        emailVerified
      }
    };
  }
}

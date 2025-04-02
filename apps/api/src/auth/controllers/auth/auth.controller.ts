import { singleton } from "tsyringe";

import type { SendVerificationEmailRequestInput } from "@src/auth";
import { AuthService, Protected } from "@src/auth/services/auth.service";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";

@singleton()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auth0: Auth0Service
  ) {}

  @Protected()
  async sendVerificationEmail({ data: { userId } }: SendVerificationEmailRequestInput) {
    const { currentUser } = this.authService;
    this.authService.throwUnlessCan("create", "VerificationEmail", { id: userId });

    await this.auth0.sendVerificationEmail(currentUser.userId);
  }
}

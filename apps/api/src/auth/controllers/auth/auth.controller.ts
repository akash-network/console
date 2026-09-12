import createError from "http-errors";
import { singleton } from "tsyringe";

import type { SendVerificationEmailRequestInput } from "@src/auth";
import { VerifyEmailRequest } from "@src/auth/http-schemas/verify-email.schema";
import { ACCOUNT_UNAVAILABLE_MESSAGE } from "@src/auth/lib/account-unavailable/account-unavailable";
import type { SignupInput } from "@src/auth/routes/signup/signup.router";
import type { VerifyEmailCodeRequest } from "@src/auth/routes/verify-email-code/verify-email-code.router";
import { AuthService, Protected } from "@src/auth/services/auth.service";
import { AUTH0_DB_CONNECTION, Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { extractAuth0ErrorMessage, isAuth0ApiError } from "@src/auth/services/auth0/auth0-error";
import { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import { UserService } from "@src/user/services/user/user.service";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";

/** Auth0 being down is not the caller's fault, and its internal message is not useful to them. */
const AUTH_PROVIDER_UNAVAILABLE_MESSAGE = "Unable to create the account right now. Please try again.";

@singleton()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auth0: Auth0Service,
    private readonly userService: UserService,
    private readonly emailVerificationCodeService: EmailVerificationCodeService,
    private readonly blockedEmailDomainService: BlockedEmailDomainService
  ) {}

  async signup(input: SignupInput) {
    if (await this.blockedEmailDomainService.isBlockedEmail(input.email)) {
      throw createError(422, ACCOUNT_UNAVAILABLE_MESSAGE);
    }

    try {
      await this.auth0.createUser({
        email: input.email,
        password: input.password,
        connection: AUTH0_DB_CONNECTION
      });
    } catch (error) {
      if (!isAuth0ApiError(error)) {
        throw error;
      }

      if (error.statusCode === 409) {
        throw createError(422, ACCOUNT_UNAVAILABLE_MESSAGE);
      }

      if (error.statusCode >= 500) {
        throw createError(502, AUTH_PROVIDER_UNAVAILABLE_MESSAGE);
      }

      throw createError(error.statusCode, extractAuth0ErrorMessage(error));
    }
  }

  @Protected()
  async sendVerificationEmail({ data: { userId } }: SendVerificationEmailRequestInput) {
    const { currentUser } = this.authService;
    this.authService.throwUnlessCan("create", "VerificationEmail", { id: userId });

    if (currentUser?.userId) {
      await this.auth0.sendVerificationEmail(currentUser.userId);
    }
  }

  @Protected()
  async sendVerificationCode() {
    const { currentUser } = this.authService;

    const result = await this.emailVerificationCodeService.sendCode(currentUser!.id);

    return { data: result };
  }

  @Protected()
  async verifyEmailCode({ data: { code } }: VerifyEmailCodeRequest) {
    const { currentUser } = this.authService;

    await this.emailVerificationCodeService.verifyCode(currentUser!.id, code);
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

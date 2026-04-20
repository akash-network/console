import { ResponseError } from "auth0";
import createError from "http-errors";
import { singleton } from "tsyringe";

import type { SendVerificationEmailRequestInput } from "@src/auth";
import { VerifyEmailRequest } from "@src/auth/http-schemas/verify-email.schema";
import type { SignupInput } from "@src/auth/routes/signup/signup.router";
import type { VerifyEmailCodeRequest } from "@src/auth/routes/verify-email-code/verify-email-code.router";
import { AuthService, Protected } from "@src/auth/services/auth.service";
import { AUTH0_DB_CONNECTION, Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import { UserService } from "@src/user/services/user/user.service";

@singleton()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auth0: Auth0Service,
    private readonly userService: UserService,
    private readonly emailVerificationCodeService: EmailVerificationCodeService
  ) {}

  async signup(input: SignupInput) {
    try {
      await this.auth0.createUser({
        email: input.email,
        password: input.password,
        connection: AUTH0_DB_CONNECTION
      });
    } catch (error) {
      if (error instanceof ResponseError) {
        if (error.statusCode === 409) {
          throw createError(422, "Unable to create account. Please try again or use a different email.");
        }

        throw createError(error.statusCode, this.extractAuth0Message(error));
      }

      throw error;
    }
  }

  private extractAuth0Message(error: ResponseError): string {
    try {
      const body = JSON.parse(error.body);
      return body.message || error.message;
    } catch {
      return error.message;
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

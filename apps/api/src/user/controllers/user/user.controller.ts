import { Context } from "hono";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { RegisterUserInput, RegisterUserResponse } from "@src/user/routes/register-user/register-user.router";
import { UserSchema } from "@src/user/schemas/user.schema";
import { UserService } from "@src/user/services/user/user.service";

@singleton()
export class UserController {
  constructor(
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly userService: UserService,
    private readonly userAuthTokenService: UserAuthTokenService
  ) {}

  get httpContext(): Context {
    return this.executionContextService.get("HTTP_CONTEXT")!;
  }

  async registerUser(data: RegisterUserInput): Promise<RegisterUserResponse> {
    const { req, env, var: httpVars } = this.httpContext;
    const userId = await this.userAuthTokenService.getValidUserId(req.header("authorization") || "", env);
    const user = await this.userService.registerUser({
      userId,
      wantedUsername: data.wantedUsername,
      email: data.email,
      emailVerified: data.emailVerified,
      subscribedToNewsletter: !!data.subscribedToNewsletter,
      ip: httpVars.clientInfo?.ip,
      userAgent: httpVars.clientInfo?.userAgent,
      fingerprint: httpVars.clientInfo?.fingerprint
    });
    return { data: user };
  }

  @Protected([{ action: "read", subject: "User" }])
  async getCurrentUser(): Promise<{ data: UserSchema }> {
    assert(this.authService.currentUser, 401);

    return { data: this.authService.currentUser as UserSchema };
  }
}

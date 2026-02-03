import { Context } from "hono";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { UserRepository } from "@src/user/repositories";
import type { RegisterUserInput, RegisterUserResponse } from "@src/user/routes/register-user/register-user.router";
import { UserSchema } from "@src/user/schemas/user.schema";
import { UserService } from "@src/user/services/user/user.service";

@singleton()
export class UserController {
  constructor(
    private readonly userRepository: UserRepository,
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
    assert(userId, 401, "Invalid or expired token");
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

  async getUserByUsername(username: string) {
    const user = await this.userService.getUserByUsername(username);
    assert(user, 404, "User not found");
    return user;
  }

  async updateSettings(data: {
    username: string;
    subscribedToNewsletter?: boolean;
    bio: string | null;
    youtubeUsername: string | null;
    twitterUsername: string | null;
    githubUsername: string | null;
  }): Promise<void> {
    assert(this.authService.currentUser?.userId, 401);

    const userId = this.authService.currentUser.id;
    await this.userService.updateUserDetails(userId, data);
  }

  async checkUsernameAvailable(username: string) {
    const existingUser = await this.userService.getUserByUsername(username);
    const isAvailable = !existingUser;
    return { isAvailable };
  }

  async subscribeToNewsletter() {
    assert(this.authService.currentUser?.userId, 401);
    const userId = this.authService.currentUser.id;
    await this.userService.subscribeToNewsletter(userId);
  }
}

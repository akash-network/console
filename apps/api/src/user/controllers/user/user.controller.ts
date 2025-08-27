import { Context } from "hono";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { UserRepository } from "@src/user/repositories";
import type { GetUserParams } from "@src/user/routes/get-anonymous-user/get-anonymous-user.router";
import type { RegisterUserInput, RegisterUserResponse } from "@src/user/routes/register-user/register-user.router";
import { AnonymousUserResponseOutput, GetUserResponseOutput, UserSchema } from "@src/user/schemas/user.schema";
import { type AdminUserDataQuery, type AdminUserDataResponse, AdminUserDataService } from "@src/user/services/admin-user-data/admin-user-data.service";
import {
  StaleAnonymousUsersCleanerOptions,
  StaleAnonymousUsersCleanerService
} from "@src/user/services/stale-anonymous-users-cleaner/stale-anonymous-users-cleaner.service";
import { UserService } from "@src/user/services/user/user.service";

@singleton()
export class UserController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly anonymousUserAuthService: AuthTokenService,
    private readonly staleAnonymousUsersCleanerService: StaleAnonymousUsersCleanerService,
    private readonly executionContextService: ExecutionContextService,
    private readonly userService: UserService,
    private readonly userAuthTokenService: UserAuthTokenService,
    private readonly adminUserDataService: AdminUserDataService
  ) {}

  get httpContext(): Context {
    return this.executionContextService.get("HTTP_CONTEXT")!;
  }

  async create(): Promise<AnonymousUserResponseOutput> {
    const user = await this.userRepository.create({
      lastIp: this.httpContext.var.clientInfo?.ip,
      lastUserAgent: this.httpContext.var.clientInfo?.userAgent,
      lastFingerprint: this.httpContext.var.clientInfo?.fingerprint
    });
    return {
      data: user,
      token: this.anonymousUserAuthService.signTokenFor({ id: user.id })
    };
  }

  @Protected([{ action: "read", subject: "User" }])
  async getById({ id }: GetUserParams): Promise<{ data: UserSchema } | GetUserResponseOutput> {
    const user = await this.userRepository.accessibleBy(this.authService.ability, "read").findById(id);

    assert(user, 404);

    return { data: user };
  }

  async cleanUpStaleAnonymousUsers(options: StaleAnonymousUsersCleanerOptions) {
    await this.staleAnonymousUsersCleanerService.cleanUpStaleAnonymousUsers(options);
  }

  async registerUser(data: RegisterUserInput): Promise<RegisterUserResponse> {
    const { req, env, var: httpVars } = this.httpContext;
    const [userId, anonymousUserId] = await Promise.all([
      this.userAuthTokenService.getValidUserId(req.header("authorization") || "", env),
      this.anonymousUserAuthService.getValidUserId(req.header("x-anonymous-authorization") || "")
    ]);
    const user = await this.userService.registerUser({
      anonymousUserId,
      userId,
      wantedUsername: data.wantedUsername,
      email: data.email,
      emailVerified: data.emailVerified,
      subscribedToNewsletter: !!data.subscribedToNewsletter,
      ip: httpVars.clientInfo?.ip,
      userAgent: httpVars.clientInfo?.userAgent,
      fingerprint: httpVars.clientInfo?.fingerprint,
      userMetadata: data.userMetadata
    });
    return { data: user };
  }

  @Protected([{ action: "read", subject: "User" }])
  async getCurrentUser(): Promise<{ data: UserSchema }> {
    assert(this.authService.currentUser, 401);

    return { data: this.authService.currentUser as UserSchema };
  }

  // @Protected([{ action: "manage", subject: "all" }])
  async getAdminUserData(query: AdminUserDataQuery): Promise<AdminUserDataResponse> {
    return await this.adminUserDataService.getAdminUserData(query);
  }
}

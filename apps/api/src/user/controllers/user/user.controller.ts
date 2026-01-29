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
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateSettings(
    userId: string,
    data: {
      username: string;
      subscribedToNewsletter: boolean;
      bio: string;
      youtubeUsername: string;
      twitterUsername: string;
      githubUsername: string;
    }
  ) {
    await this.userService.updateSettings(
      userId,
      data.username,
      data.subscribedToNewsletter,
      data.bio,
      data.youtubeUsername,
      data.twitterUsername,
      data.githubUsername
    );
  }

  async getTemplateById(templateId: string, userId: string = "") {
    const template = await this.userService.getTemplateById(templateId, userId);
    if (!template) {
      throw new Error("Template not found");
    }
    return template;
  }

  async saveTemplate(
    userId: string,
    data: {
      id: string;
      sdl: string;
      isPublic: boolean;
      title: string;
      cpu: number;
      ram: number;
      storage: number;
    }
  ) {
    return await this.userService.saveTemplate(data.id, userId, data.sdl, data.title, data.cpu, data.ram, data.storage, data.isPublic);
  }

  async saveTemplateDesc(userId: string, data: { id: string; description: string }) {
    await this.userService.saveTemplateDesc(data.id, userId, data.description);
  }

  async getTemplates(username: string, userId: string = "") {
    const templates = await this.userService.getTemplates(username, userId);
    if (!templates) {
      throw new Error("User not found.");
    }
    return templates;
  }

  async deleteTemplate(userId: string, templateId: string) {
    await this.userService.deleteTemplate(userId, templateId);
  }

  async checkUsernameAvailable(username: string) {
    const isAvailable = await this.userService.checkUsernameAvailable(username);
    return { isAvailable };
  }

  async getFavoriteTemplates(userId: string) {
    return await this.userService.getFavoriteTemplates(userId);
  }

  async addFavoriteTemplate(userId: string, templateId: string) {
    await this.userService.addFavoriteTemplate(userId, templateId);
  }

  async removeFavoriteTemplate(userId: string, templateId: string) {
    await this.userService.removeFavoriteTemplate(userId, templateId);
  }

  async subscribeToNewsletter(userId: string) {
    await this.userService.subscribeToNewsletter(userId);
  }
}

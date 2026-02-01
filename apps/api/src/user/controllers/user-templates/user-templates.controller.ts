import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserTemplatesService } from "@src/user/services/user-templates/user-templates.service";

@singleton()
export class UserTemplatesController {
  constructor(
    private readonly authService: AuthService,
    private readonly userTemplatesService: UserTemplatesService
  ) {}

  async getTemplateById(templateId: string) {
    const userId = this.authService.safeCurrentUser?.userId || "";
    const template = await this.userTemplatesService.getTemplateById(templateId, userId);
    assert(template, 404, "Template not found");
    return template;
  }

  async saveTemplate(data: { id: string; sdl: string; isPublic: boolean; title: string; cpu: number; ram: number; storage: number }) {
    assert(this.authService.safeCurrentUser?.userId, 401);
    const userId = this.authService.safeCurrentUser.userId;
    return await this.userTemplatesService.saveTemplate(data.id, userId, data);
  }

  async updateTemplate(data: { id: string; description: string }) {
    assert(this.authService.safeCurrentUser?.userId, 401);
    const userId = this.authService.safeCurrentUser.userId;
    await this.userTemplatesService.update(data.id, userId, data);
  }

  async getTemplates(username: string) {
    const userId = this.authService.safeCurrentUser?.userId || "";
    const templates = await this.userTemplatesService.getTemplates(username, userId);
    assert(templates, 404, "User not found.");
    return templates;
  }

  async deleteTemplate(templateId: string) {
    assert(this.authService.safeCurrentUser?.userId, 401);
    const userId = this.authService.safeCurrentUser.userId;
    await this.userTemplatesService.deleteTemplate(userId, templateId);
  }

  async getFavoriteTemplates() {
    assert(this.authService.safeCurrentUser?.userId, 401);
    const userId = this.authService.safeCurrentUser.userId;
    return await this.userTemplatesService.getFavoriteTemplates(userId);
  }

  async addFavoriteTemplate(templateId: string) {
    assert(this.authService.safeCurrentUser?.userId, 401);
    const userId = this.authService.safeCurrentUser.userId;
    await this.userTemplatesService.addFavoriteTemplate(userId, templateId);
  }

  async removeFavoriteTemplate(templateId: string) {
    assert(this.authService.safeCurrentUser?.userId, 401);
    const userId = this.authService.safeCurrentUser.userId;
    await this.userTemplatesService.removeFavoriteTemplate(userId, templateId);
  }
}
